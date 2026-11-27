import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireSessionUser } from '@/lib/auth/require-session-user'
import { fetchHistoricalCandles } from '@/lib/ticks/fetch'
import { snapshotFromProvider } from '@/lib/market-analysis/acquire'
import { buildWorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import { TIMEFRAME_SECONDS } from '@/lib/market-analysis/snapshot'

export const runtime = 'nodejs'
const LIMIT = 400

export async function POST() {
  const user = await requireSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const asOf = Date.now()
  // Exclusive open-time cursor at the current bucket start excludes active candles.
  const before = (seconds: number) => Math.floor(asOf / 1000 / seconds) * seconds
  try {
    const [M3, M15] = await Promise.all([
      fetchHistoricalCandles({ symbol: 'EURUSD', timeframe: '3m', before: before(TIMEFRAME_SECONDS.M3), limit: LIMIT }),
      fetchHistoricalCandles({ symbol: 'EURUSD', timeframe: '15m', before: before(TIMEFRAME_SECONDS.M15), limit: LIMIT }),
    ])
    const snapshot = snapshotFromProvider(randomUUID(), asOf, { M3, M15 })
    return NextResponse.json(buildWorkspaceAnalysis(snapshot), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('market analysis scan failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Unable to acquire or analyze market data.' }, { status: 500 })
  }
}
