import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VOLUME_PROFILE_BIN_SIZE, fetchVolumeProfileTickCounts } from '@/lib/ticks/volume-profile'

const SYMBOL = 'EURUSD'

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

  try {
    const data = await fetchVolumeProfileTickCounts({
      symbol,
      fromMsc,
      toMsc,
      binSize: VOLUME_PROFILE_BIN_SIZE,
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('volume profile', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'volume_profile_failed' }, { status: 500 })
  }
}
