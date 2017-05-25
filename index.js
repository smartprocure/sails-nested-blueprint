let service = require('./service')
let {controller} = require('sails-async')

// Lifted from sails blueprint hook's parseBlueprintOptions
// Get the model identity from the action name (e.g. 'user/find').
let getModelName = req => req.options.action.split('/')[0]
let blueprintFromReq = req => service(req._sails.models, getModelName(req))

module.exports = {
  service,
  getModelName,
  blueprintFromReq,
  blueprint: controller({
    create: async req => blueprintFromReq(req).createNested(req.allParams())
  })
}