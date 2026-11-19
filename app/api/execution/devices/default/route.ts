import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultDeviceId } from '@/lib/execution/device-access'
import { fetchWarehousePresence } from '@/lib/execution/ws-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deviceId = defaultDeviceId()
  const { data } = await supabase
    .from('execution_devices')
    .select('device_id, account_id, label')
    .eq('user_id', user.id)
    .eq('device_id', deviceId)
    .maybeSingle()

  const online = await fetchWarehousePresence(deviceId)
  return NextResponse.json({
    deviceId,
    accountId: data?.account_id ?? 'primary',
    label: data?.label ?? 'Home MT5',
    warehouseOnline: online,
    presenceSource: 'router',
  })
}