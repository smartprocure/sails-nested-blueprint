let F = require('futil-js')
let _ = require('lodash/fp')
let publishDestroy = (model, id, req) => model._publishDestroy(id, req)
let publishCreate = (model, record, req) => model._publishCreate(record, req)
let publishUpdate = (model, id, changes) => model._publishUpdate(id, changes)
let hash = require('object-hash')

let blacklist = ['limit', 'sort']
let memoryCache = {}
let defaultCacheProvider = {
  get: key => _.get(key, memoryCache),
  set: (key, value) => F.setOn(key, value, memoryCache),
  del: _.each(key => delete memoryCache[key])
}
let keygen = (req, res, params, queryObject, modelName) =>
  hash(queryObject)

let syncIDs = async (prefix, key, result, get, set) => {
  let ids = []
  F.deepMap(x => {
    let id = _.get('id', x)
    if (id) ids.push(id)
    return x
  }, result)
  let keys = await get(`${prefix}-keys`)
  if (!_.isPlainObject(keys)) keys = {}
  _.each(id => {
    keys[id] = _.uniq(_.concat(keys[id] || [], key))
  }, ids)
  await set(`${prefix}-keys`, keys)
}

module.exports = (models, modelName, req, res) => {
  let destroy = _.curry(async (cacheOptions, options, record) => {
    let {soft = false, cascade = false, customDelete, beforeDelete} = options
    let model = models[modelName]
    let id = record.id

    if (cacheOptions) {
      let prefix = cacheOptions.prefix
      let { get, del } = _.extend(defaultCacheProvider, cacheOptions.provider)
      let keys = await get(`${prefix}-keys`)
      if (_.get(id, keys)) await del(keys[id])
    }

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

  let updateNested = async record => {
    let model = models[modelName]

    let id = record.id
    let originalRecord = await model.findOne({id}).then()
    let updatedRecord = await model.update({id}, _.extend(originalRecord, _.mapValues(x => _.get('id', x) || x, record))).meta({ fetch: true }).then()
    console.log({originalRecord, updatedRecord})

    await Promise.all(_.map(async association => {
      // Get Child Info
      let childRecord = record[association.alias]
      if (!childRecord || _.isString(childRecord)) return {}

      let childModel = models[association[association.type]]
      let childModelAssociation = _.find({collection: modelName}, childModel.associations) ||
        _.find({model: modelName}, childModel.associations)

      // Update child
      childRecord[childModelAssociation.alias] = childModelAssociation.type === 'collection' ? [id] : id
      let childId = childRecord.id
      await childModel.update({ id: childId }, childRecord).then()

      return {
        [association.alias]: association.type === 'collection' ? [childId] : childId
      }
    }, model.associations))

    publishUpdate(model, updatedRecord.id, record)
    return _.extend({statusCode: 201}, updatedRecord)
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

  let cachedFind = _.curry(async (options, params) => {
    let model = models[modelName]
    let { get, set } = _.extend(defaultCacheProvider, options.provider)
    let prefix = options.prefix
    let queryObject = _.omit(blacklist, params)
    if (queryObject.isDeleted) queryObject.isDeleted = false
    let key = (options.keygen || keygen)(req, res, params, queryObject, modelName)
    let cached
    if (key) cached = await get(`${prefix}-${key}`)
    if (key && cached) {
      return cached
    } else {
      let build = model.find(queryObject)
      _.each(blacklisted => {
        if (params[blacklisted]) build = build[blacklisted](params[blacklisted])
      }, blacklist)
      _.each(({ alias }) => {
        build = build.populate(alias)
      }, model.associations)
      let result = await build.then()
      await syncIDs(prefix, `${prefix}-${key}`, result, get, set)
      await set(`${prefix}-${key}`, result)
      return result
    }
  })

  let clearCacheUpdate = _.curry(async (options, params) => {
    let { get, del } = _.extend(defaultCacheProvider, options.provider)
    let prefix = options.prefix
    let keys = await get(`${prefix}-keys`)
    if (_.get(params.id, keys)) await del(keys[params.id])
    return updateNested(params)
  })

  return {
    count,
    createNested,
    updateNested,
    destroy,
    destroyNested: destroy(null, {cascade: true}),
    destroyNestedSoft: destroy(null, {soft: true, cascade: true}),
    destroySoft: destroy({soft: true}),
    cachedFind,
    clearCacheUpdate
  }
}
