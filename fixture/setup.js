const sails = require('sails')
const request = require('supertest')

beforeAll(() => new Promise((resolve, reject) => {
  process.chdir(__dirname)
  global.jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000
  sails.lift({
    log: {
      level: 'error'
    },
    hooks: {
      grunt: false,
      autoreload: false,
      pubsub: false,
      sockets: false,
      views: false,
      i18n: false
    }
  }, err => {
    global.app = request(sails.hooks.http.app)
    err ? reject(err) : resolve(sails)
  })
}))

afterAll(sails.lower)
