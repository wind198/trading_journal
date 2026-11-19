import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_DEVICE = 'home-mt5'

export async function assertDeviceAccess(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('execution_devices')
    .select('device_id')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error) return false
  return Boolean(data)
}

export function defaultDeviceId(): string {
  return process.env.EXECUTION_DEFAULT_DEVICE_ID ?? DEFAULT_DEVICE
}