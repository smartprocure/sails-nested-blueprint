﻿[![CircleCI](https://circleci.com/gh/smartprocure/sails-nested-blueprint.svg?style=svg)](https://circleci.com/gh/smartprocure/sails-nested-blueprint)

# sails-nested-blueprint
As of sails 1.0, blueprints no longer support nested creates (passing along associated models during creates).
This library brings it back in a non-obstrusive way.

## Usage

### Blueprint (Easiest)
The blueprint will automatically figure out which model to use just like sails blueprints.
`blueprint` exposes a `create` and a `destroy` method, so just do this in a controller method:

```js
let {blueprint} = require('sails-nested-blueprint')
module.exports = blueprint

```

### Service
You can also use the service directly if you need to perform a nested
create (or destroy) as part of some other operation.
On the service, these functions are called `createNested` and `destroyNested`.

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
