import assert from 'node:assert/strict'
import {test} from 'node:test'
import {resolveScanCutoff,m15CloseFromLocalInput,localDateTimeInput} from './scan-cutoff'
const now=Date.parse('2026-11-27T12:34:00.000Z')
test('latest keeps server cutoff; history requires completed aligned M15 close',()=>{
 assert.equal(resolveScanCutoff(undefined,now),now)
 assert.equal(resolveScanCutoff('2026-11-27T12:30:00.000Z',now),Date.parse('2026-11-27T12:30:00.000Z'))
 for(const value of ['2026-11-27T12:35:00.000Z','2026-11-27T12:45:00.000Z','2026-11-27T12:30:00','2026-02-30T12:30:00.000Z',null,123])
  assert.throws(()=>resolveScanCutoff(value,now))
})
test('local input round trips through UTC and floors to M15 boundary',()=>{
 const aligned=Math.floor(now/900000)*900000
 assert.equal(m15CloseFromLocalInput(localDateTimeInput(now)),new Date(aligned).toISOString())
})
