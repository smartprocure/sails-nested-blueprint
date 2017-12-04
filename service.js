let F = require('futil-js')
let _ = require('lodash/fp')
let publishDestroy = (model, id, req) => model._publishDestroy(id, req)
let publishCreate = (model, record, req) => model._publishCreate(record, req)
let publishUpdate = (model, id, record, req) => model._publishUpdate(id, record, req)
let hash = require('object-hash')

let blacklist = ['limit', 'sort', 'skip']
let memoryCache = {}
let defaultCacheProvider = {
  get: key => _.get(key, memoryCache),
  set: (key, value) => F.setOn(key, value, memoryCache),
  del: _.each(key => delete memoryCache[key]),
  keys: () => _.keys(memoryCache)
}
let keygen = (req, res, params, queryObject, modelName) =>
  hash(queryObject)

let syncIDs = async (modelName, prefix, key, result, get, set) => {
  let ids = []
  F.deepMap(x => {
    let id = _.get('id', x)
    if (id) ids.push(id)
    return x
  }, result)
  let keysKey = `${prefix}-${modelName}-keys`
  let found = await get(modelName, keysKey)
  if (!_.isPlainObject(found)) found = {}
  _.each(id => {
    found[id] = _.uniq(_.concat(found[id] || [], key))
  }, ids)
  await set(modelName, keysKey, found)
}

let clearCache = async (modelName, { prefix, provider }, id) => {
  let { get, del, keys } = _.extend(defaultCacheProvider, provider)
  let found = await get(modelName, `${prefix}-${modelName}-keys`)
  if (_.get(id, found)) await del(modelName, found[id])
  await del(modelName, await keys(modelName, `${prefix}-${modelName}*`))
}

let subscribeToAllIDs = (req, model, result) => {
  if (req.isSocket) {
    // Record-specific updates
    model.subscribe(req, _.map('id', _.castArray(result)))
    // Model/Collection level updates
    model._watch(req)
  }
}

let findPopulated = async (model, query, params = {}) => {
  let build = model.find(query)
  _.each(blacklisted => {
    if (params[blacklisted]) build = build[blacklisted](params[blacklisted])
  }, blacklist)
  _.each(({ alias }) => {
    build = build.populate(alias)
  }, model.associations)
  return build.then()
}
let findOnePopulated = async (model, query) => _.head(await findPopulated(model, query, {limit: 1}))

module.exports = (models, modelName, req, res) => {
  let destroy = _.curry(async (cacheOptions, options, record) => {
    let {soft = false, cascade = false, customDelete, beforeDelete} = options
    let model = models[modelName]
    let id = record.id

    if (cacheOptions) await clearCache(modelName, cacheOptions, id)

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

  let updateNested = async (cacheOptions, record) => {
    let model = models[modelName]
    let id = record.id

    if (cacheOptions) await clearCache(modelName, cacheOptions, id)

    let originalRecord = await model.findOne({id}).then()
    let flatRecord = _.mapValues(x => _.get('id', x) || x, record)
    await model.update({id}, _.extend(originalRecord, flatRecord)).then()
    let updatedRecord = await findOnePopulated(model, {id})

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
      await _.head(childModel.update({ id: childId }, childRecord).then())
      publishUpdate(
        childModel,
        childId,
        childRecord,
        req
      )

      return {
        [association.alias]: association.type === 'collection' ? [childId] : childId
      }
    }, model.associations))

    publishUpdate(model, id, updatedRecord, req)
    return _.extend({statusCode: 201}, updatedRecord)
  }

  let createNested = async (cacheOptions, record) => {
    if (cacheOptions) await clearCache(modelName, cacheOptions)

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
      let newRecord = await childModel.create(childRecord).meta({fetch: true}).then()
      publishCreate(childModel, newRecord, req)

      return {
        [association.alias]: association.type === 'collection' ? [newRecord.id] : newRecord.id
      }
    }, model.associations))

    await model.update({id})
      .set(_.reduce(_.extend, {}, updates))
      .then()

    let newRecord = await findOnePopulated(model, {id})
    publishCreate(model, newRecord, req)
    return _.extend({statusCode: 201}, newRecord)
  }

  let cachedFind = _.curry(async (options, params) => {
    let model = models[modelName]
    let { get, set } = _.extend(defaultCacheProvider, options.provider)
    let prefix = options.prefix
    let queryObject = _.omit(blacklist, params)
    if (queryObject.isDeleted) queryObject.isDeleted = { '!=': true }
    let key = (options.keygen || keygen)(req, res, params, queryObject, modelName)
    let cached
    if (key) cached = await get(modelName, `${prefix}-${modelName}-${key}`)
    if (key && cached) {
      subscribeToAllIDs(req, model, cached)
      return cached
    } else {
      let result = await findPopulated(model, queryObject, params)
      await syncIDs(modelName, prefix, `${prefix}-${modelName}-${key}`, result, get, set)
      await set(modelName, `${prefix}-${modelName}-${key}`, result)
      subscribeToAllIDs(req, model, result)
      return result
    }
  })

  return {
    count,
    createNested,
    updateNested,
    destroy,
    destroyNested: destroy(null, {cascade: true}),
    destroyNestedSoft: destroy(null, {soft: true, cascade: true}),
    destroySoft: destroy({soft: true}),
    cachedFind
  }
}
