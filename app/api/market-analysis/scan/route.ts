import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireSessionUser } from '@/lib/auth/require-session-user'
import { fetchHistoricalCandles } from '@/lib/ticks/fetch'
import { snapshotFromProvider } from '@/lib/market-analysis/acquire'
import { attachTickVolume } from '@/lib/market-analysis/volume-acquisition'
import { buildWorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import { resolveScanCutoff } from '@/lib/market-analysis/scan-cutoff'
import { TIMEFRAME_SECONDS } from '@/lib/market-analysis/snapshot'

export const runtime = 'nodejs'
const LIMIT = 800

export async function POST(request:Request) {
  const user = await requireSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let asOf:number
  try{
    const raw=await request.text()
    if(raw.length>1024)throw new Error('Invalid body')
    const body:unknown=raw?JSON.parse(raw):{}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='asOf'))throw new Error('Invalid body')
    asOf=resolveScanCutoff((body as {asOf?:unknown}).asOf,Date.now())
  }catch{
    return NextResponse.json({error:'Select a valid completed M15 close in UTC.'},{status:400})
  }
  // Exclusive open-time cursor at the current bucket start excludes active candles.
  const before = (seconds: number) => Math.floor(asOf / 1000 / seconds) * seconds
  try {
    const [M3, M15] = await Promise.all([
      fetchHistoricalCandles({ symbol: 'EURUSD', timeframe: '3m', before: before(TIMEFRAME_SECONDS.M3), limit: LIMIT }),
      fetchHistoricalCandles({ symbol: 'EURUSD', timeframe: '15m', before: before(TIMEFRAME_SECONDS.M15), limit: LIMIT }),
    ])
    const snapshot = snapshotFromProvider(randomUUID(), asOf, { M3, M15 })
    let volumeBars:Awaited<ReturnType<typeof attachTickVolume>>=[]
    try{volumeBars=await attachTickVolume(M3,asOf)}catch{console.warn('M3 tick volume unavailable')}
    return NextResponse.json({...buildWorkspaceAnalysis(snapshot),volumeBars}, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('market analysis scan failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Unable to acquire or analyze market data.' }, { status: 500 })
  }
}
