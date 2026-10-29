import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  VOLUME_PROFILE_BIN_SIZE,
  VOLUME_PROFILE_WINDOW_MS,
  fetchVolumeProfileTickCounts,
} from '@/lib/ticks/volume-profile'

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

  const fromMsc = Date.now() - VOLUME_PROFILE_WINDOW_MS

  try {
    const data = await fetchVolumeProfileTickCounts({
      symbol,
      fromMsc,
      binSize: VOLUME_PROFILE_BIN_SIZE,
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('volume profile', error instanceof Error ? error.message : 'failed')
    return NextResponse.json({ error: 'volume_profile_failed' }, { status: 500 })
  }
}
