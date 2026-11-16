import assert from 'node:assert/strict'
import test from 'node:test'
import { effect, pipe } from './pipe'

test('pipe preserves order and passes changed types between stages', () => {
  const calls: string[] = []
  const workflow = pipe(
    (value: number) => { calls.push('map'); return String(value) },
    (value: string) => { calls.push('decide'); return { value } },
    effect((value: { value: string }) => { calls.push(`apply:${value.value}`) }),
  )

  assert.deepEqual(workflow(7), { value: '7' })
  assert.deepEqual(calls, ['map', 'decide', 'apply:7'])
})

test('pipe stops on a thrown error and leaves it observable', () => {
  const error = new Error('mapping failed')
  let applied = false
  const workflow = pipe(
    (_value: number): string => { throw error },
    (value: string) => value.length,
    effect((_value: number) => { applied = true }),
  )

  assert.throws(() => workflow(1), (caught) => caught === error)
  assert.equal(applied, false)
})
