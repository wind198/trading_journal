import { NextResponse, type NextRequest } from 'next/server'
import { fetchRecentCandles } from '@/lib/ticks/fetch'
import { CANDLE_TIMEFRAMES, RECENT_CANDLE_LIMIT, type CandleTimeframe } from '@/lib/ticks/candles'
import { createClient } from '@/lib/supabase/server'

function isTimeframe(value: string): value is CandleTimeframe {
  return value in CANDLE_TIMEFRAMES
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const timeframe = request.nextUrl.searchParams.get('timeframe') ?? ''
  if (!isTimeframe(timeframe)) {
    return NextResponse.json({ error: 'Bad timeframe' }, { status: 400 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? RECENT_CANDLE_LIMIT)
  if (!Number.isInteger(limit) || limit < 1 || limit > RECENT_CANDLE_LIMIT) {
    return NextResponse.json({ error: 'Bad limit' }, { status: 400 })
  }

  try {
    const data = await fetchRecentCandles({ symbol: 'EURUSD', timeframe, limit })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('candles recent', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'bars_failed' }, { status: 500 })
  }
}
