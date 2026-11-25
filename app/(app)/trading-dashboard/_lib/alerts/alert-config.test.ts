import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadAlertConfigWithClient, saveAlertConfigWithClient, isValidAlertInterval } from './alert-config'

test('saving alert config upserts only the signed-in user row', async () => {
  const calls: string[] = []
  const query = {
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => {
      calls.push(`upsert:${String(values.user_id)}:${options.onConflict}:${String(values.force_candle)}:${String(values.interval)}`)
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
    forceCandle: true, doublePattern: false, engulfing: false, doji: false, interval: 30,
  })
  assert.deepEqual(calls, ['upsert:test-user:user_id:true:30', 'select:user_id'])
})

test('loading alert config filters by the signed-in user and defaults missing rows to 15 minutes and other alerts off', async () => {
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
  assert.deepEqual(config, { forceCandle: false, doublePattern: false, engulfing: false, doji: false, interval: 15 })
})

test('anonymous sessions cannot edit alert config', async () => {
  await assert.rejects(
    saveAlertConfigWithClient({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => { throw new Error('query must not run') },
    } as never, { forceCandle: true, doublePattern: false, engulfing: false, doji: false, interval: 15 }),
    /Sign in to edit alert config/,
  )
})

test('interval accepts whole minutes only', () => {
  for(const v of [0,-1,1.5,1441,NaN,Infinity]) assert.equal(isValidAlertInterval(v),false)
  for(const v of [1,15,30,1440]) assert.equal(isValidAlertInterval(v),true)
})
test('configured interval loads from the user row', async () => {
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{force_candle:false,double_pattern:false,engulfing:false,doji:false,interval:45},error:null})}
  const config=await loadAlertConfigWithClient({auth:{getUser:async()=>({data:{user:{id:'test-user'}},error:null})},from:()=>query} as never)
  assert.equal(config.interval,45)
})
