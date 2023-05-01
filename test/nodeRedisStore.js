/* globals decribe */
'use strict'
const assert = require('assert')
const NodeRedisStore = require('../nodeRedisStore')
const FakeRedisClient = require("./fakeRedisClient")
const sinon = require("sinon")

class FakeRedisClientV4 extends FakeRedisClient {
  constructor(legacyMode) {
    super()
    this.options = { legacyMode }
    this.connect = async () => {}

    this.v4 = {
      set: this.set.bind(this),
      get: this.get.bind(this),
      del: this.del.bind(this)
    }
  }
}

class FakeRedisClientV3  {
  constructor() {
    this.reset()
  }

  async get(key, cb) {
    const result = this.store.get(key)
    // IoRedis returns null when the key is not found.
    if (cb && typeof cb === 'function') {
      cb(null, result == undefined ? null : result)
    }
  }

  async set(key, value) {
    this.store.set(key, value)
    const cb = arguments[arguments.length - 1]

    if (cb && typeof cb === 'function') {
      cb()
    }
  }

  async del(key, cb) {
    this.store.delete(key)

    if (cb && typeof cb === 'function') {
      cb()
    }
  }

  reset() {
    this.store = new Map()
  }
}


describe('# nodeRedisStore test', function() {
  const fakeRedisClient = new FakeRedisClientV3()
  const fakeRedisClientV4Legacy = new FakeRedisClientV4(true)
  const fakeRedisClientV4 = new FakeRedisClientV4(false)

  const redisStoreV3 = new NodeRedisStore(fakeRedisClient)
  const redisStoreV4Legacy = new NodeRedisStore(fakeRedisClientV4Legacy)
  const redisStoreV4 = new NodeRedisStore(fakeRedisClientV4)

  afterEach(function() {
    sinon.restore()
    fakeRedisClient.reset()
    fakeRedisClientV4.reset()
    fakeRedisClientV4Legacy.reset()
  })

  it('returns undefined when not found', async function() {
    assert.equal(await redisStoreV3.get('foo'), undefined)
    assert.equal(await redisStoreV4Legacy.get('foo'), undefined)
    assert.equal(await redisStoreV4.get('foo'), undefined)
  })

  it('returns cached value', async function() {
    await redisStoreV3.set('foo', {value: 42})
    assert.deepEqual(await redisStoreV3.get('foo'), {value: 42})

    await redisStoreV4Legacy.set('foo', {value: 42})
    assert.deepEqual(await redisStoreV4Legacy.get('foo'), {value: 42})

    await redisStoreV4.set('foo', {value: 42})
    assert.deepEqual(await redisStoreV4.get('foo'), {value: 42})
  })

  it('serializes values with v3', async function() {
    const v3SetSpy = sinon.spy(fakeRedisClient, 'set')

    await redisStoreV3.set('foo', {value: 42})
    await redisStoreV3.set('foo', 42)

    assert(v3SetSpy.calledTwice)
    assert.deepEqual(
      v3SetSpy.firstCall.args,
      ['foo', '{"value":42}', 'PX', undefined]
    )

    assert.deepEqual(
      v3SetSpy.secondCall.args,
      ['foo', '42', 'PX', undefined]
    )

    await redisStoreV4.set('foo', {value: 42})
    await redisStoreV4.set('foo', 42)
  })

  it ('should serializes values with v4', async function() {
    const v4SetSpy = sinon.spy(fakeRedisClientV4, 'set')

    await redisStoreV4.set('foo', {value: 42})
    await redisStoreV4.set('foo', 42)

    assert(v4SetSpy.calledTwice)
    assert.deepEqual(
      v4SetSpy.firstCall.args,
      ['foo', '{"value":42}', {}]
    )

    assert.deepEqual(
      v4SetSpy.secondCall.args,
      ['foo', '42', {}]
    )
  })

  it ('should serializes values with v4 legacy mode', async function() {
    const v4LegacySetSpy = sinon.spy(fakeRedisClientV4Legacy.v4, 'set')

    await redisStoreV4Legacy.set('foo', {value: 42})
    await redisStoreV4Legacy.set('foo', 42)

    assert(v4LegacySetSpy.calledTwice)
    assert.deepEqual(
      v4LegacySetSpy.firstCall.args,
      ['foo', '{"value":42}', {}]
    )

    assert.deepEqual(
      v4LegacySetSpy.secondCall.args,
      ['foo', '42', {}]
    )
  })

  it('should use only use `.v4.get` when using v4 and legacyMode flag is on', async function() {
    const v4LegacyGetSpy = sinon.spy(fakeRedisClientV4Legacy.v4, 'get')
    await redisStoreV4Legacy.get('foo')
    assert(v4LegacyGetSpy.calledOnce)

    const v3GetSpy = sinon.spy(fakeRedisClient, 'get')
    await redisStoreV3.get('foo')
    assert(v3GetSpy.calledOnce)

    const v4GetSpy = sinon.spy(fakeRedisClientV4, 'get')
    await redisStoreV4.get('foo')
    assert(v4GetSpy.calledOnce)
  })

  it('should only use `.del` regardless of the version', async function() {
    const v4LegacyDelSpy = sinon.spy(fakeRedisClientV4Legacy, 'del')
    await redisStoreV4Legacy.del('foo')
    assert(v4LegacyDelSpy.calledOnce)

    const v3DelSpy = sinon.spy(fakeRedisClient, 'del')
    await redisStoreV3.del('foo')
    assert(v3DelSpy.calledOnce)

    const v4DelSpy = sinon.spy(fakeRedisClientV4, 'del')
    await redisStoreV4.del('foo')
    assert(v4DelSpy.calledOnce)
  })

  it('should use only use `.v4.set` when using v4 and legacyMode flag is on', async function() {
    const v4LegacySetSpy = sinon.spy(fakeRedisClientV4Legacy.v4, 'set')
    await redisStoreV4Legacy.set('foo', {value: 42})
    assert(v4LegacySetSpy.calledOnce)

    const v3SetSpy = sinon.spy(fakeRedisClient, 'set')
    await redisStoreV3.set('foo', {value: 42})
    assert(v3SetSpy.calledOnce)

    const v4SetSpy = sinon.spy(fakeRedisClientV4, 'set')
    await redisStoreV4.set('foo', {value: 42})
    assert(v4SetSpy.calledOnce)
  })

  it('should serialize values for v4', async function() {
    const setSpy = sinon.spy(fakeRedisClientV4Legacy.v4, 'set')

    await redisStoreV4Legacy.set('foo', {value: 42})
    await redisStoreV4Legacy.set('foo', 42)

    assert(setSpy.calledTwice)
    assert.deepEqual(
      setSpy.firstCall.args,
      ['foo', '{"value":42}', {}]
    )

    assert.deepEqual(
      setSpy.secondCall.args,
      ['foo', '42', {}]
    )
  })

  it('sets ttl', async function() {
    const v3SetSpy = sinon.spy(fakeRedisClient, 'set')

    await redisStoreV3.set('foo', {value: 42}, 1200)

    assert(v3SetSpy.calledOnce)
    assert.deepEqual(
      v3SetSpy.firstCall.args,
      ['foo', '{"value":42}', 'PX', 1200])
  })

  it ('sets ttl for v4', async function() {
    const setSpy = sinon.spy(fakeRedisClientV4, 'set')

    await redisStoreV4.set('foo', {value: 42}, 1200)

    assert(setSpy.calledOnce)
    assert.deepEqual(
      setSpy.firstCall.args,
      ['foo', '{"value":42}', {PX: 1200}])
  })

  it ('sets ttl for v4 legacy', async function() {
    const setSpy = sinon.spy(fakeRedisClientV4Legacy.v4, 'set')

    await redisStoreV4Legacy.set('foo', {value: 42}, 1200)

    assert(setSpy.calledOnce)
    assert.deepEqual(
      setSpy.firstCall.args,
      ['foo', '{"value":42}', {PX: 1200}])
  })

  it('deletes values', async function() {
    await redisStoreV3.set('foo', {value:42})
    assert.deepEqual(await redisStoreV3.get('foo'), {value:42})
    await redisStoreV3.del('foo')
    assert.deepEqual(await redisStoreV3.get('foo'), undefined)

    await redisStoreV4.set('foo', {value:42})
    assert.deepEqual(await redisStoreV4.get('foo'), {value:42})
    await redisStoreV4.del('foo')
    assert.deepEqual(await redisStoreV4.get('foo'), undefined)

    await redisStoreV4Legacy.set('foo', {value:42})
    assert.deepEqual(await redisStoreV4Legacy.get('foo'), {value:42})
    await redisStoreV4Legacy.del('foo')
    assert.deepEqual(await redisStoreV4Legacy.get('foo'), undefined)
  })
})
