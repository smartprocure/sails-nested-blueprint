/**
 * ParentController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const blueprint = require('../../../index').blueprint

module.exports = {
  destroy: blueprint.destroySoft
}
