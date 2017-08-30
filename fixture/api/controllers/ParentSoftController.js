/**
 * ParentController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const blueprint = require('../../../index').blueprintOptions({
  destroy: {soft: true, cascade: true}
})

module.exports = blueprint
