import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadAlertConfigWithClient, saveAlertConfigWithClient } from './alert-config'

test('saving alert config upserts only the signed-in user row', async () => {
  const calls: string[] = []
  const query = {
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => {
      calls.push(`upsert:${String(values.user_id)}:${options.onConflict}:${String(values.force_candle)}`)
      return query
    },
    select: (column: string) => {
      calls.push(`select:${column}`)
      return query
    },
    single: async () => ({ data: { user_id: 'test-user' }, error: null }),
  }
  await saveAlertConfigWithClient({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
    from: () => query,
  } as never, {
    forceCandle: true, doublePattern: false, engulfing: false, doji: false,
  })
  assert.deepEqual(calls, ['upsert:test-user:user_id:true', 'select:user_id'])
})

test('loading alert config filters by the signed-in user and defaults missing rows off', async () => {
  const calls: string[] = []
  const query = {
    select: () => query,
    eq: (column: string, value: string) => { calls.push(`${column}:${value}`); return query },
    maybeSingle: async () => ({ data: null, error: null }),
  }
  const config = await loadAlertConfigWithClient({
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }) },
    from: () => query,
  } as never)
  assert.deepEqual(calls, ['user_id:test-user'])
  assert.deepEqual(config, { forceCandle: false, doublePattern: false, engulfing: false, doji: false })
})

test('anonymous sessions cannot edit alert config', async () => {
  await assert.rejects(
    saveAlertConfigWithClient({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => { throw new Error('query must not run') },
    } as never, { forceCandle: true, doublePattern: false, engulfing: false, doji: false }),
    /Sign in to edit alert config/,
  )
})
