module.exports = class FakeRedisClient {
  constructor() {
    this.reset()
  }

  async get(key) {
    const result = this.store.get(key)
    // IoRedis returns null when the key is not found.
    return Promise.resolve(result == undefined ? null : result)
  }

  async set(key, value, ttl) {
    this.store.set(key, value)
    return Promise.resolve()
  }

  async del(key) {
    this.store.delete(key)
    return Promise.resolve()
  }

  reset() {
    this.store = new Map()
  }
}
