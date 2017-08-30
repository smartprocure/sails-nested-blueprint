describe('Blueprints', () => {
  let parentId

  it('should create a child with a nested hard delete parent', async () => {
    let response = await global.app.post('/child').type('json').send({childProperty: 'child data', parent: { parentProperty: 'parent data' }})
    expect(response.status).toBe(201)
    parentId = response.body.parent
  })

  it('should hard delete a parent and its children', async () => {
    let parent = (await global.app.get(`/parent/${parentId}`).type('json')).body
    let response = await global.app.delete(`/parent/`).type('json').send(parent)
    expect(response.status).toBe(200)

    let deletedParentResponse = await global.app.get(`/parent/${parentId}`).type('json')
    expect(deletedParentResponse.status).toBe(404)

    let deletedChildResponse = await global.app.get(`/child/${parent.children[0].id}`).type('json')
    expect(deletedChildResponse.status).toBe(404)
  })

  it('should create a child with a nested soft delete parent', async () => {
    let response = await global.app.post('/child').type('json').send({childProperty: 'child data', parentSoft: { parentProperty: 'parent data' }})
    expect(response.status).toBe(201)
    parentId = response.body.parentSoft
  })

  it('should soft delete a parent and its children', async () => {
    let parentSoft = (await global.app.get(`/parentsoft/${parentId}`).type('json')).body
    let response = await global.app.delete(`/parentsoft/`).type('json').send(parentSoft)
    expect(response.status).toBe(200)
    parentSoft = (await global.app.get(`/parentsoft/${parentId}`).type('json')).body
    expect(parentSoft.isDeleted).toBe(true)
    expect(parentSoft.children[0].isDeleted).toBe(true)
  })
})
