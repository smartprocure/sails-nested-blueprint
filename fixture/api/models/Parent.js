/**
 * Parent.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    parentProperty: {type: 'string'},
    children: {
      collection: 'child',
      via: 'parent'
    }
  }
}
