import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  Creatable,
  InteractionEvent,
  InteractionResult,
} from './interaction-contract'
import { InteractionEffectRunner } from './interaction-effect-runner'
import { InteractionOwnerRegistry } from './interaction-owner-registry'
import { InteractionStore } from './interaction-store'

type State = { value: number }

class FakeOwner implements Creatable<State> {
  readonly id: string

  constructor(id: string) { this.id = id }

  beginCreation(_input: unknown): InteractionResult<State> {
    return {
      state: { value: 1 },
      status: 'active',
      effects: [{ scopeId: this.id, type: 'began' }],
    }
  }

  continueCreation(state: State, event: InteractionEvent): InteractionResult<State> {
    if (event.type === 'cancel') {
      return {
        state,
        status: 'cancelled',
        effects: [{ scopeId: this.id, type: 'cancelled', payload: event.reason }],
      }
    }
    if (event.type === 'confirm') {
      return {
        state,
        status: 'committed',
        effects: [{ scopeId: this.id, type: 'committed' }],
      }
    }
    return { state: { value: state.value + 1 }, status: 'active' }
  }
}

function setup() {
  const seenEffects: string[] = []
  const registry = new InteractionOwnerRegistry()
  const effects = new InteractionEffectRunner((effect) => {
    seenEffects.push(`${effect.scopeId}:${effect.type}:${String(effect.payload ?? '')}`)
  })
  const store = new InteractionStore(registry, effects)
  return { registry, store, seenEffects }
}

test('store owns opaque state and commits exactly once', () => {
  const { registry, store, seenEffects } = setup()
  registry.registerCreation(new FakeOwner('rect'))
  const snapshots: string[] = []
  store.subscribe((snapshot) => snapshots.push(snapshot.status))

  assert.equal(store.begin({ scopeId: 'rect', workflow: 'create', pointerId: 7 }), true)
  assert.deepEqual(store.snapshot, {
    status: 'active', scopeId: 'rect', workflow: 'create', pointerId: 7, state: { value: 1 },
  })
  assert.equal(store.dispatch({ type: 'confirm' }), true)
  assert.equal(store.dispatch({ type: 'confirm' }), false)
  assert.deepEqual(store.snapshot, { status: 'idle' })
  assert.deepEqual(seenEffects, ['rect:began:', 'rect:committed:'])
  assert.deepEqual(snapshots, ['active', 'idle'])
})

test('replacement cancels the previous owner before beginning the next', () => {
  const { registry, store, seenEffects } = setup()
  registry.registerCreation(new FakeOwner('a'))
  registry.registerCreation(new FakeOwner('b'))

  store.begin({ scopeId: 'a', workflow: 'create' })
  store.begin({ scopeId: 'b', workflow: 'create' })

  assert.deepEqual(seenEffects, ['a:began:', 'a:cancelled:replaced', 'b:began:'])
})

test('store rejects stale pointers and cancels on dispose', () => {
  const { registry, store, seenEffects } = setup()
  registry.registerCreation(new FakeOwner('rect'))
  store.begin({ scopeId: 'rect', workflow: 'create', pointerId: 3 })

  assert.equal(store.dispatch({
    type: 'pointer-move',
    pointer: {
      pointerId: 4,
      pointerType: 'mouse',
      coarse: false,
      primary: true,
      screen: { x: 0, y: 0 },
      chartPoint: null,
    },
  }), false)
  assert.deepEqual(store.snapshot, {
    status: 'active', scopeId: 'rect', workflow: 'create', pointerId: 3, state: { value: 1 },
  })

  store.dispose()
  store.dispose()
  assert.deepEqual(store.snapshot, { status: 'idle' })
  assert.equal(store.begin({ scopeId: 'rect', workflow: 'create' }), false)
  assert.deepEqual(seenEffects, ['rect:began:', 'rect:cancelled:chart-dispose'])
})

test('registry resolves business workflows by generic priority', () => {
  const registry = new InteractionOwnerRegistry()
  registry.registerCreation(new FakeOwner('low'), 1)
  registry.registerCreation(new FakeOwner('high'), 10)
  assert.deepEqual(registry.forWorkflow('create').map((owner) => owner.scopeId), ['high', 'low'])
  assert.deepEqual(registry.forWorkflow('edit').map((owner) => owner.scopeId), [])
})
