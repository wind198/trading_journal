import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelConditionalOrder } from '@/lib/execution/ws-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: order, error } = await supabase
    .from('conditional_orders')
    .select('order_id, device_id, account_id')
    .eq('order_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await cancelConditionalOrder(
    order.order_id,
    order.device_id,
    order.account_id ?? 'primary',
  )

  if (result.result === 'WAREHOUSE_OFFLINE') {
    return NextResponse.json(
      { orderId: id, result: result.result, message: 'Warehouse offline; cancel not applied.' },
      { status: 503 },
    )
  }
  if (result.result === 'UNKNOWN_OUTCOME') {
    return NextResponse.json(
      { orderId: id, result: result.result, message: 'Cancel outcome unknown; reconcile.' },
      { status: 504 },
    )
  }

  return NextResponse.json({ orderId: id, result: result.result, state: result.state })
}