import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  CANDLE_TIMEFRAMES,
  type CandleTimeframe,
} from '@/lib/ticks/candles'
import {
  VOLUME_PROFILE_BIN_SIZE,
  fetchVolumeProfilePayload,
} from '@/lib/ticks/volume-profile'

const SYMBOL = 'EURUSD'
const ALLOWED_TF = new Set<string>(['3m', '15m'])

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  try {
    const data = await fetchVolumeProfilePayload({
      symbol,
      fromMsc,
      toMsc,
      intervalSec,
      binSize: VOLUME_PROFILE_BIN_SIZE,
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('volume profile', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'volume_profile_failed' }, { status: 500 })
  }
}
