let _ = require('lodash/fp')

module.exports = (models, modelName) => ({
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
      childRecord[childModelAssociation.alias] = childModelAssociation.type == 'collection' ? [id] : id
      let {childId} = await childModel.create(childRecord).meta({fetch: true}).then()

      return {
        [association.alias]: association.type == 'collection' ?  [childId] : childId
      }
    }, model.associations))

    await model.update({id})
      .set(_.reduce(_.extend, {}, updates))
      .then()

    return 201
  },
  destroyNested: async record => {
    let model = models[modelName]
    let id = record.id

    await Promise.all(_.map(async association => {
      // Get Child Info
      let childRecord = record[association.alias]
      if (!childRecord) return

      let childModel = models[association[association.type]]

      // Destroy child
      await childModel.destroy(childRecord).then()
    }, model.associations))

    await model.destroy({id})

    return 200
  }
})
