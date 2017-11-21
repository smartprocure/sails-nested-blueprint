let service = require('./service')
let {controller} = require('sails-async')
let _ = require('lodash/fp')

// Lifted from sails blueprint hook's parseBlueprintOptions
// Get the model identity from the action name (e.g. 'user/find').
let getModelName = req => req.params.model || req.options.action.split('/')[0]
let serviceFromReq = (req, res) => service(req._sails.models, getModelName(req), req, res)
let create = async req => serviceFromReq(req).createNested(req.allParams())
let cleanParams = req => _.omit('model', req.allParams())

module.exports = {
  service,
  getModelName,
  serviceFromReq,
  blueprint: controller({
    create,
    destroy: async req => serviceFromReq(req).destroyNested(cleanParams(req)),
    count: async (req, res) => serviceFromReq(req, res).count(cleanParams(req))
  }),
  blueprintOptions: (options = {}) => controller({
    create,
    cachedFind: async req => serviceFromReq(req).cachedFind(options.cache, cleanParams(req)),
    clearCacheUpdate: async req => serviceFromReq(req).clearCacheUpdate(options.cache, cleanParams(req)),
    destroy: async req => serviceFromReq(req).destroy(options.destroy, cleanParams(req)),
    count: async (req, res) => serviceFromReq(req, res).count(cleanParams(req))
  })
}
