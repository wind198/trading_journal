import { createClient } from '@/lib/supabase/client'

export type AlertConfig = {
  forceCandle: boolean
  doublePattern: boolean
  engulfing: boolean
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  forceCandle: false,
  doublePattern: false,
  engulfing: false,
}

type AlertConfigRow = {
  force_candle: boolean
  double_pattern: boolean
  engulfing: boolean
}

function fromRow(row: AlertConfigRow): AlertConfig {
  return {
    forceCandle: row.force_candle,
    doublePattern: row.double_pattern,
    engulfing: row.engulfing,
  }
}

export async function loadAlertConfig(): Promise<AlertConfig> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('alert_config')
    .select('force_candle, double_pattern, engulfing')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as AlertConfigRow) : { ...DEFAULT_ALERT_CONFIG }
}

export async function saveAlertConfig(config: AlertConfig): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('alert_config').upsert({
    id: 1,
    force_candle: config.forceCandle,
    double_pattern: config.doublePattern,
    engulfing: config.engulfing,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) throw error
}
