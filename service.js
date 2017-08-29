let _ = require('lodash/fp')

module.exports = (models, modelName) => {
  let destroy = _.curry(async (options, record) => {
    let {soft = false, cascade = false, customDelete, beforeDelete} = options
    let model = models[modelName]
    let id = record.id

    if (_.isFunction(customDelete)) await customDelete(options, record, model, models)
    else {
      // Current cascade implementation supports deleting a matching association as part of the passed in deleted entity (record)
      // TODO: Allow some sort of automatic cascading delete based on the associations of the deleted entity
      if (cascade) {
        await Promise.all(_.map(async association => {
          // Get Child Info
          let childRecord = record[association.alias]
          if (!childRecord) return
          if (_.isArray(childRecord)) childRecord = {id: _.map(child => child.id || child, childRecord)}
          let childModel = models[association[association.type]]

          // Destroy child
          if (soft) await childModel.update(childRecord, {isDeleted: true}).then()
          else await childModel.destroy(childRecord).then()
        }, model.associations))
      }
      if (_.isFunction(beforeDelete)) await beforeDelete(options, record, model, models)
      if (soft) await model.update({id}, {isDeleted: true}).then()
      else await model.destroy({id}).then()
    }

    return 200
  })

  return {
    createNested: async record => {
      let model = models[modelName]

      let associationIds = _.flow(
        _.map('alias'),
        _.filter(id => _.isPlainObject(record[id]))
      )(model.associations)

      let {id} = await model.create(_.omit(associationIds, record)).meta({fetch: true}).then()

      let updates = await Promise.all(_.map(async association => {
        // Get Child Info
        let childRecord = record[association.alias]
        if (!childRecord || _.isString(childRecord)) return {}

        let childModel = models[association[association.type]]
        let childModelAssociation = _.find({collection: modelName}, childModel.associations) ||
          _.find({model: modelName}, childModel.associations)

        // Create child
        childRecord[childModelAssociation.alias] = childModelAssociation.type === 'collection' ? [id] : id
        let {childId} = await childModel.create(childRecord).meta({fetch: true}).then()

        return {
          [association.alias]: association.type === 'collection' ? [childId] : childId
        }
      }, model.associations))

      await model.update({id})
        .set(_.reduce(_.extend, {}, updates))
        .then()

      return _.extend({statusCode: 201}, await model.findOne({id}).then())
    },
    destroy,
    destroyNested: destroy({cascade: true})
  }
}
