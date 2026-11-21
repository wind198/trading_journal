import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAlertConfigDebouncer } from './alert-config-debounce'

test('rapid alert changes send once, two seconds after the last change', () => {
  let now = 0
  let saved = 0
  const pending = new Map<ReturnType<typeof setTimeout>, { due: number; callback: () => void }>()
  const debouncer = createAlertConfigDebouncer(() => { saved++ }, {
    set: (callback, delay) => {
      const timer = {} as ReturnType<typeof setTimeout>
      pending.set(timer, { due: now + delay, callback })
      return timer
    },
    clear: (timer) => { pending.delete(timer) },
  })
  debouncer.schedule()
  now = 1_500
  debouncer.schedule()
  assert.equal(pending.size, 1)
  assert.equal(saved, 0)
  now = 3_499
  assert.equal([...pending.values()].some((item) => item.due <= now), false)
  now = 3_500
  const [timer, item] = [...pending.entries()][0]!
  assert.equal(item.due, now)
  pending.delete(timer)
  item.callback()
  assert.equal(saved, 1)
  debouncer.schedule()
  debouncer.cancel()
  assert.equal(pending.size, 0)
})
