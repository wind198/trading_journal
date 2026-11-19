import assert from 'node:assert/strict'
import test from 'node:test'
import {
  readEurusdCalculatorInputs,
  writeEurusdCalculatorInputs,
} from './eurusd-calculator-storage'

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
    value: () => value,
  }
}

test('reads valid persisted risk and stop-loss defaults', () => {
  const storage = memoryStorage(JSON.stringify({ riskUsd: '40', stopLossPoints: '60' }))
  assert.deepEqual(readEurusdCalculatorInputs(storage), {
    riskUsd: '40',
    stopLossPoints: '60',
  })
})

test('ignores malformed and non-positive persisted values', () => {
  assert.deepEqual(readEurusdCalculatorInputs(memoryStorage('not-json')), {})
  const storage = memoryStorage(JSON.stringify({ riskUsd: '-2', stopLossPoints: '0' }))
  assert.deepEqual(readEurusdCalculatorInputs(storage), {})
})

test('writes valid inputs and retains the last valid value while an input is empty', () => {
  const storage = memoryStorage(JSON.stringify({ riskUsd: '40', stopLossPoints: '60' }))
  writeEurusdCalculatorInputs(storage, { riskUsd: '55.5', stopLossPoints: '' })
  assert.deepEqual(JSON.parse(storage.value()!), {
    riskUsd: '55.5',
    stopLossPoints: '60',
  })
})

test('does not write when neither current nor stored values are valid', () => {
  const storage = memoryStorage()
  writeEurusdCalculatorInputs(storage, { riskUsd: '', stopLossPoints: 'abc' })
  assert.equal(storage.value(), null)
})
