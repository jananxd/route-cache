'use strict'
const { promisify } = require('util')

// This store is designed to work with https://github.com/redis/node-redis

class NodeRedisStore {
  constructor (redisClient) {
    this.client = redisClient

    if (!this.isV4) {
      this.client.get = promisify(this.client.get).bind(this.client)
      this.client.set = promisify(this.client.set).bind(this.client)
      this.client.del = promisify(this.client.del).bind(this.client)
    }
  }

  // `connect` is a method that exists on redis v4 but not v3.
  get isV4 () {
    return 'connect' in this.client
  }

  async get (key) {
    let val
    if (this.isV4 && this.client.options.legacyMode) {
      val = await this.client.v4.get(key)
    } else {
      val = await this.client.get(key)
    }
    try {
      return JSON.parse(val)
    } catch (error) {
      return val
    }
  }

  // Value must be a json-serializable object.
  async set (key, value, ttlMillis) {
    // user using redis v4 legacy mode
    const v4Options = {}

    if (ttlMillis) {
      v4Options.PX = ttlMillis
    }
    if (this.isV4) {
      if (this.client.options.legacyMode) {
        return this.client.v4.set(key, JSON.stringify(value), v4Options)
      } else {
        return this.client.set(key, JSON.stringify(value), v4Options)
      }
    }
    return this.client.set(key, JSON.stringify(value), 'PX', ttlMillis)
  }

  async del (key) {
    return this.client.del(key)
  }
}

module.exports = NodeRedisStore
