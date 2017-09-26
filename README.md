[![CircleCI](https://circleci.com/gh/smartprocure/sails-nested-blueprint.svg?style=svg)](https://circleci.com/gh/smartprocure/sails-nested-blueprint)

# sails-nested-blueprint
As of sails 1.0, blueprints no longer support nested creates (passing along associated models during creates).
This library brings it back in a non-obstrusive way.

## Usage

### Blueprint (Easiest)
The blueprint will automatically figure out which model to use just like sails blueprints.
`blueprint` exposes a `create`, a `destroy` and a `count` method, so just do this in a controller method:

```js
let {blueprint} = require('sails-nested-blueprint')
module.exports = blueprint

### Blueprint with options (Soft Delete)
Works just like the regular blueprint example, howerver allows passing an object with options for each of the blueprint methods.
Currently only `delete` supports options such as `cascade` (causes any associated record passed in with the main record to be deleted, same as `serviceFromReq(req).destroyNested`)
and `soft` (keeps the record but sets a flag `IsDeleted` to true on the affected records).

### "Soft Delete" Setup
In order for soft delete to work you have to add a boolean attribute to the model definition or in /config/models.js (to enable all your models to support soft deletes)

```js
let {blueprint} = require('sails-nested-blueprint')
// model using these blueprints will have its `isDeleted` attribute set to true instead of being deleted from the data store.
// If associated models are passed with the main record, they will also be soft-deleted since cascade is set to true
module.exports = blueprintOptions({destroy: {soft: true, cascade: true}})

```

The `count` endpoint allows you to reach to `/[model]/count` with a
query to retrieve the number of found elements, instead of the full
JSON object.

### Service
You can also use the service directly if you need to perform a nested
create (or destroy) as part of some other operation.
On the service, these functions are called `createNested` and `destroyNested`.
To perform a soft delete with a service use `destroy({soft: true}, record)` or `destroySoft(record)` or combine both nested and soft deletion `destroyNestedSoft(record)`

```js
let {service} = require('sails-nested-blueprint')
let sails = require('sails')
let SomeOperation = async (...args) => {
  let payload = getPayload(args)
  await service(sails.models, 'SomeModel').createNested(payload) // Returns 201 if successful
  doMoreStuff()
}
```

You can also use the helper utilities directly in a controller method to recreate what `blueprint` does:

```js
let {serviceFromReq, service} = require('sails-nested-blueprint')
module.exports = {
  create: async (req, res) => res
    .status(await serviceFromReq(req).createNested(req.allParams()))
    .send()
}
```

It is much nicer if you use `sails-async` - see the index.js source for the implementation
