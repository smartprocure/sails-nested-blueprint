describe('Parent Controller', () => {
  let id

  it('should create a parent', async () => {
    let response = await global.app.post('/parent').field('testProperty', 'some data')
    expect(response.status).toBe(200)
    id = response.body.id
  })

  it('should update a parent', async () => {
    let response = await global.app.put(`/parent/${id}`).field('testProperty', 'updated')
    expect(response.status).toBe(200)
    id = response.body.id
  })

  it('should delete a parent', async () => {
    let response = await global.app.delete(`/parent/${id}`)
    expect(response.status).toBe(200)
  })
})
