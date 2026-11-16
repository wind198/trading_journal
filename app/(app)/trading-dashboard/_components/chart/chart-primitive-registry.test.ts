import assert from 'node:assert/strict'
import test from 'node:test'
import { asPrimitiveLayer, ChartPrimitiveRegistry } from './chart-primitive-registry'

function fakeLayer(id: string) {
  let draft: unknown = null
  let hitBoost = 1
  return {
    id,
    get draft() { return draft },
    setDraft(next: unknown) { draft = next },
    setHitBoost(boost: number) { hitBoost = boost },
    getHitBoost() { return hitBoost },
  }
}

test('registry fans hitBoost and routes drafts without sibling leaks', () => {
  const registry = new ChartPrimitiveRegistry()
  const a = fakeLayer('a')
  const b = fakeLayer('b')
  registry.register('a', asPrimitiveLayer(a))
  registry.register('b', asPrimitiveLayer(b))

  registry.setHitBoost(1.75)
  assert.equal(a.getHitBoost(), 1.75)
  assert.equal(b.getHitBoost(), 1.75)

  registry.setDraft('a', { p1: { time: 1, price: 1 } })
  assert.deepEqual(a.draft, { p1: { time: 1, price: 1 } })
  assert.equal(b.draft, null)

  registry.setDraft('b', { p1: { time: 2, price: 2 } })
  assert.equal(a.draft, null)
  assert.deepEqual(b.draft, { p1: { time: 2, price: 2 } })

  registry.clearDrafts()
  assert.equal(a.draft, null)
  assert.equal(b.draft, null)
})
