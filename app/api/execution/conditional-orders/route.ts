import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { assertDeviceAccess, defaultDeviceId } from '@/lib/execution/device-access'
import type { ConditionalOrderInput } from '@/lib/execution/types'
import { toCreateCommandV2 } from '@/lib/execution/validate'
import { installConditionalOrder } from '@/lib/execution/ws-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('conditional_orders')
    .select(
      'order_id, device_id, execution_state, persistence_status, recorded_at, calculated_volume_lots, failure_reason, created_at, command',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    projectionLagDisclaimer:
      'History is asynchronously projected; recently armed orders may lag by a few seconds.',
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ConditionalOrderInput
  try {
    body = (await request.json()) as ConditionalOrderInput
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const deviceId = body.deviceId ?? defaultDeviceId()
  const allowed = await assertDeviceAccess(supabase, user.id, deviceId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden device' }, { status: 403 })
  }

  const orderId = randomUUID()
  let command: ReturnType<typeof toCreateCommandV2>
  try {
    command = toCreateCommandV2(orderId, { ...body, deviceId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid command'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  void supabase.from('conditional_orders').insert({
    order_id: orderId,
    user_id: user.id,
    device_id: deviceId,
    account_id: command.account_id,
    command,
    execution_state: 'SUBMITTED',
    persistence_status: 'pending',
  })

  let install
  try {
    install = await installConditionalOrder(command)
  } catch (err) {
    console.error('execution install', err)
    return NextResponse.json({ error: 'Execution router unavailable' }, { status: 502 })
  }

  if (install.result === 'WAREHOUSE_OFFLINE') {
    return NextResponse.json(
      {
        orderId,
        result: install.result,
        reason: install.reason,
        message: 'Warehouse offline; command was not queued.',
      },
      { status: 503 },
    )
  }

  if (install.result === 'UNKNOWN_OUTCOME') {
    return NextResponse.json(
      {
        orderId,
        result: install.result,
        reason: install.reason,
        message: 'Outcome unknown; reconcile by order ID before creating a new order.',
      },
      { status: 504 },
    )
  }

  if (install.result !== 'ARMED') {
    return NextResponse.json(
      { orderId, result: install.result, reason: install.reason },
      { status: 422 },
    )
  }

  return NextResponse.json(
    {
      orderId,
      result: install.result,
      state: install.state,
      calculatedVolumeLots: install.calculatedVolumeLots,
    },
    { status: 201 },
  )
}