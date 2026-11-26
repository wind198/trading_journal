import { NextResponse, type NextRequest } from 'next/server'
import { requireSessionUser } from '@/lib/auth/require-session-user'
import {
  CANDLE_TIMEFRAMES,
  type CandleTimeframe,
} from '@/lib/ticks/candles'
import {
  VOLUME_PROFILE_BIN_SIZE,
  fetchVolumeProfilePayload,
  fetchVolumeProfileTimeTickCounts,
} from '@/lib/ticks/volume-profile'

const SYMBOL = 'EURUSD'
const ALLOWED_TF = new Set<string>(Object.keys(CANDLE_TIMEFRAMES))

export async function GET(request: NextRequest) {
  const user = await requireSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const symbol = request.nextUrl.searchParams.get('symbol') ?? SYMBOL
  if (symbol !== SYMBOL) {
    return NextResponse.json({ error: 'Bad symbol' }, { status: 400 })
  }

  const fromRaw = request.nextUrl.searchParams.get('from_msc')
  const toRaw = request.nextUrl.searchParams.get('to_msc')
  const fromMsc = fromRaw == null ? Number.NaN : Number(fromRaw)
  const toMsc = toRaw == null ? Number.NaN : Number(toRaw)
  if (!Number.isFinite(fromMsc) || !Number.isFinite(toMsc) || !(toMsc > fromMsc)) {
    return NextResponse.json({ error: 'Bad window' }, { status: 400 })
  }

  const tfRaw = request.nextUrl.searchParams.get('timeframe') ?? '15m'
  if (!ALLOWED_TF.has(tfRaw)) {
    return NextResponse.json({ error: 'Bad timeframe' }, { status: 400 })
  }
  const intervalRaw = request.nextUrl.searchParams.get('interval_sec')
  const intervalFromQuery = intervalRaw == null ? Number.NaN : Number(intervalRaw)
  const intervalSec =
    Number.isFinite(intervalFromQuery) && intervalFromQuery >= 1
      ? Math.floor(intervalFromQuery)
      : CANDLE_TIMEFRAMES[tfRaw as CandleTimeframe]

  const lowRaw=request.nextUrl.searchParams.get('price_low'),highRaw=request.nextUrl.searchParams.get('price_high'),binsRaw=request.nextUrl.searchParams.get('bins')
  const custom=lowRaw!==null||highRaw!==null||binsRaw!==null
  const low=Number(lowRaw),high=Number(highRaw),bins=Number(binsRaw)
  if(custom&&(lowRaw===null||highRaw===null||binsRaw===null||!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<low||![20,30,40].includes(bins)))return NextResponse.json({error:'Bad price grid'},{status:400})
  try {
    const options = {
      symbol,
      fromMsc,
      toMsc,
      intervalSec,
      binSize: VOLUME_PROFILE_BIN_SIZE,
      grid:custom?{low,high,bins}:undefined,
    }
    const data = request.nextUrl.searchParams.get('time_only') === '1'
      ? { price: [], time: await fetchVolumeProfileTimeTickCounts(options) }
      : await fetchVolumeProfilePayload(options)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('volume profile', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'volume_profile_failed' }, { status: 500 })
  }
}
