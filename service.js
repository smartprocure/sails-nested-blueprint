let F = require('futil-js')
let _ = require('lodash/fp')
let publishDestroy = (model, id, req) => model._publishDestroy(id, req)
let publishCreate = (model, record, req) => model._publishCreate(record, req)
let hash = require('object-hash')

let blacklist = ['limit', 'sort']
let memoryCache = {}
let defaultCacheProvider = {
  get: key => _.get(key, memoryCache),
  set: (key, value) => F.setOn(key, value, memoryCache)
}
let keygen = (req, res, params, queryObject, modelName) => {
  if (!req.user) return
  return hash(queryObject)
}

module.exports = (models, modelName, req, res) => {
  let cachedFind = _.curry(async (options, params) => {
    let { get, set } = _.extend(options.provider, defaultCacheProvider)
    let key = (options.keygen || keygen)(req, res, params, modelName)
    let queryObject = _.omit(blacklist, params)
    if (queryObject.isDeleted) queryObject.isDeleted = false
    let cached
    if (key) cached = await get(key)
    if (key && cached) {
      return cached
    } else {
      let build = models[modelName].find(queryObject)
      _.each(key => {
        if (params[key]) build = build[key](params[key])
      }, blacklist)
      let result = await build.then()
      await set(key, result)
      return result
    }
  })

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

    publishDestroy(model, id)
    return 200
  })

  let count = async record => {
    let model = models[modelName]
    return {count: await model.count(record)}
  }

  let createNested = async record => {
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

    let newRecord = await model.findOne({id}).then()

    publishCreate(model, newRecord)
    return _.extend({statusCode: 201}, newRecord)
  }

  return {
    cachedFind,
    count,
    createNested,
    destroy,
    destroyNested: destroy({cascade: true}),
    destroyNestedSoft: destroy({soft: true, cascade: true}),
    destroySoft: destroy({soft: true})
  }
}
