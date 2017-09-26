let service = require('./service')
let {controller} = require('sails-async')

// Lifted from sails blueprint hook's parseBlueprintOptions
// Get the model identity from the action name (e.g. 'user/find').
let getModelName = req => req.options.action.split('/')[0]
let serviceFromReq = (req, res) => service(req._sails.models, getModelName(req), req, res)
let create = async req => serviceFromReq(req).createNested(req.allParams())

module.exports = {
  service,
  getModelName,
  serviceFromReq,
  blueprint: controller({
    create,
    destroy: async req => serviceFromReq(req).destroyNested(req.allParams()),
    count: async (req, res) => serviceFromReq(req, res).count(req.allParams())
  }),
  blueprintOptions: (options = {}) => controller({
    create,
    destroy: async req => serviceFromReq(req).destroy(options.destroy, req.allParams()),
    count: async (req, res) => serviceFromReq(req, res).count(req.allParams())
  })
}
