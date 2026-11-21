import { createClient } from '@/lib/supabase/client'

export type AlertConfig = {
  forceCandle: boolean
  doublePattern: boolean
  engulfing: boolean
  doji: boolean
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  forceCandle: false,
  doublePattern: false,
  engulfing: false,
  doji: false,
}

type AlertConfigRow = {
  created_at: string
  force_candle: boolean
  double_pattern: boolean
  engulfing: boolean
  doji: boolean
}

function fromRow(row: AlertConfigRow): AlertConfig {
  return {
    forceCandle: row.force_candle,
    doublePattern: row.double_pattern,
    engulfing: row.engulfing,
    doji: row.doji,
  }
}

async function loadFirstRow(supabase: ReturnType<typeof createClient>): Promise<AlertConfigRow | null> {
  const { data, error } = await supabase
    .from('alert_config')
    .select('created_at, force_candle, double_pattern, engulfing, doji')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function loadAlertConfig(): Promise<AlertConfig> {
  const row = await loadFirstRow(createClient())
  return row ? fromRow(row) : { ...DEFAULT_ALERT_CONFIG }
}

export async function saveAlertConfig(config: AlertConfig): Promise<void> {
  const supabase = createClient()
  const row = await loadFirstRow(supabase)
  const values = {
    force_candle: config.forceCandle,
    double_pattern: config.doublePattern,
    engulfing: config.engulfing,
    doji: config.doji,
    updated_at: new Date().toISOString(),
  }
  const table = supabase.from('alert_config')
  const { error } = row
    ? await table.update(values).eq('created_at', row.created_at)
    : await table.insert(values)
  if (error) throw error
}
