# 1.5.0
- Added nestedUpdate, using it for the cached update, and clearing
  caches on the destroy methods.

# 1.4.4
- Fixed an issue with the cached update.

# 1.4.3
- Improved the cached API.

# 1.4.2
- Added the clearCacheUpdate method, and improved the cachedFind
  method to populate associations.

# 1.4.1
- Fixes for the cachedFind method.

 # 1.4.0
- Added the cachedFind method.

# 1.3.3
- Supporting shared methods by getting the model out of params, and
  ignoring the model from the params once we pass the params to the
  methods.

 # 1.3.2
- Making sure count returns an object instead of using res.send
  directly.

 # 1.3.1
- Add publish events for create/destroy.

# 1.3.0
- Add count.

# 1.2.1
- Output lint for Duti

# 1.2.0
- Add "soft" delete. Requires the model to have a boolean attribute IsDeleted (ideally should be added to /config/models.js)

# 1.1.4
- Always run duti in Circle

# 1.1.3
- Use latest duti version

# 1.1.2
- Add duti to the repo

# 1.1.1
- Supporting manual associations for attributes type `model` through an ObjectID as string

# 1.1.0
- Added nested destroy

# 1.0.1
- Fix readme typos

# 1.0.0
- Initial Release
