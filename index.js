let service = require('./service')
let {controller} = require('sails-async')

// Lifted from sails blueprint hook's parseBlueprintOptions
// Get the model identity from the action name (e.g. 'user/find').
let getModelName = req => req.options.action.split('/')[0]
let serviceFromReq = req => service(req._sails.models, getModelName(req))

module.exports = {
  service,
  getModelName,
  serviceFromReq,
  blueprint: controller({
    create: async req => serviceFromReq(req).createNested(req.allParams()),
    destroy: async req => serviceFromReq(req).destroyNested(req.allParams()),
    destroySoft: async req => serviceFromReq(req).destroySoft(req.allParams())
  })
}
