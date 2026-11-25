import { createClient } from '@/lib/supabase/client'

export type AlertConfig = {
  forceCandle: boolean
  doublePattern: boolean
  engulfing: boolean
  doji: boolean
  interval: number
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  forceCandle: false,
  doublePattern: false,
  engulfing: false,
  doji: false,
  interval: 15,
}

export const MIN_ALERT_INTERVAL = 1
export const MAX_ALERT_INTERVAL = 1440
export type AlertToggleKey = Exclude<keyof AlertConfig, 'interval'>
export function isValidAlertInterval(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_ALERT_INTERVAL && value <= MAX_ALERT_INTERVAL
}

type AlertConfigRow = {
  force_candle: boolean
  double_pattern: boolean
  engulfing: boolean
  doji: boolean
  interval: number
}

function fromRow(row: AlertConfigRow): AlertConfig {
  return {
    forceCandle: row.force_candle,
    doublePattern: row.double_pattern,
    engulfing: row.engulfing,
    doji: row.doji,
    interval: isValidAlertInterval(row.interval) ? row.interval : DEFAULT_ALERT_CONFIG.interval,
  }
}

async function requireAuthenticated(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Sign in to edit alert config')
  return user.id
}

export async function loadAlertConfigWithClient(
  supabase: ReturnType<typeof createClient>,
): Promise<AlertConfig> {
  const userId = await requireAuthenticated(supabase)
  const { data, error } = await supabase
    .from('alert_config')
    .select('force_candle, double_pattern, engulfing, doji, interval')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as AlertConfigRow) : { ...DEFAULT_ALERT_CONFIG }
}

export async function loadAlertConfig(): Promise<AlertConfig> {
  return loadAlertConfigWithClient(createClient())
}

export async function saveAlertConfig(config: AlertConfig): Promise<void> {
  await saveAlertConfigWithClient(createClient(), config)
}

export async function saveAlertConfigWithClient(
  supabase: ReturnType<typeof createClient>,
  config: AlertConfig,
): Promise<void> {
  if (!isValidAlertInterval(config.interval)) throw new Error('Invalid alert interval')
  const userId = await requireAuthenticated(supabase)

  const values = {
    user_id: userId,
    force_candle: config.forceCandle,
    double_pattern: config.doublePattern,
    engulfing: config.engulfing,
    doji: config.doji,
    interval: config.interval,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('alert_config')
    .upsert(values, { onConflict: 'user_id' })
    .select('user_id')
    .single()

  if (error) throw error
}
