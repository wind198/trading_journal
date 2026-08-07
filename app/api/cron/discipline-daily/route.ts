import { NextRequest, NextResponse } from 'next/server'
import { DISCIPLINE_ITEM_KEYS } from '@/lib/discipline'
import { todayVn } from '@/lib/date-range'
import { createServiceClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function ensureDayWithItems(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  checkDate: string
) {
  const { data: existingDay, error: findError } = await supabase
    .from('discipline_days')
    .select('id')
    .eq('user_id', userId)
    .eq('check_date', checkDate)
    .maybeSingle()

  if (findError) throw findError

  let dayId = existingDay?.id as string | undefined

  if (!dayId) {
    const { data: created, error: createError } = await supabase
      .from('discipline_days')
      .insert([{ user_id: userId, check_date: checkDate }])
      .select('id')
      .single()

    if (createError) {
      // Race: another insert won UNIQUE — fetch it
      const { data: raced, error: raceError } = await supabase
        .from('discipline_days')
        .select('id')
        .eq('user_id', userId)
        .eq('check_date', checkDate)
        .single()
      if (raceError) throw createError
      dayId = raced.id
    } else {
      dayId = created.id
    }
  }

  const items = DISCIPLINE_ITEM_KEYS.map((item_key) => ({
    day_id: dayId!,
    item_key,
    checked: false,
  }))

  const { error: itemsError } = await supabase.from('discipline_check_items').upsert(items, {
    onConflict: 'day_id,item_key',
    ignoreDuplicates: true,
  })

  if (itemsError) throw itemsError
  return dayId!
}

async function seedToday() {
  const supabase = createServiceClient()
  const checkDate = todayVn()

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  })

  if (usersError) throw usersError

  let seeded = 0
  for (const user of users.users) {
    await ensureDayWithItems(supabase, user.id, checkDate)
    seeded += 1
  }

  return { checkDate, users: seeded }
}

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await seedToday()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron/discipline-daily]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
