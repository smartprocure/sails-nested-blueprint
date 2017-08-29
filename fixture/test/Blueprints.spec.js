describe('Blueprints', () => {
  let parentId

  it('should create a child with a parent', async () => {
    let response = await global.app.post('/child').type('json').send({childProperty: 'child data', parent: { parentProperty: 'parent data' }})
    expect(response.status).toBe(201)
    parentId = response.body.parent
  })

  it('should delete a parent and its children', async () => {
    let parent = (await global.app.get(`/parent/${parentId}`).type('json')).body
    let response = await global.app.delete(`/parent/`).type('json').send(parent)
    expect(response.status).toBe(200)
  })
})
