let service = require('./service')
let {controller} = require('sails-async')
let _ = require('lodash/fp')

// Lifted from sails blueprint hook's parseBlueprintOptions
// Get the model identity from the action name (e.g. 'user/find').
let getModelName = req => req.params.model || req.options.action.split('/')[0]
let serviceFromReq = (req, res) => service(req._sails.models, getModelName(req), req, res)
let create = async req => serviceFromReq(req).createNested(null, req.allParams())
let update = async req => serviceFromReq(req).updateNested(null, req.allParams())
let cleanParams = req => _.omit('model', req.allParams())

module.exports = {
  service,
  getModelName,
  serviceFromReq,
  blueprint: controller({
    create,
    update,
    destroy: async req => serviceFromReq(req).destroyNested(cleanParams(req)),
    count: async (req, res) => serviceFromReq(req, res).count(cleanParams(req))
  }),
  blueprintOptions: (options = {}) => {
    let methods = {
      create: async req => serviceFromReq(req).createNested(options.cache, req.allParams()),
      update: async req => serviceFromReq(req).updateNested(options.cache, req.allParams()),
      destroy: async req => serviceFromReq(req).destroy(options.cache, options.destroy, cleanParams(req)),
      count: async (req, res) => serviceFromReq(req, res).count(cleanParams(req))
    }
    if (options.cache) {
      methods.find = async req => serviceFromReq(req).cachedFind(options.cache, cleanParams(req))
    }
    return controller(methods)
  }
}
