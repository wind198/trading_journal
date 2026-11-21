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
  id: number
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

async function loadFirstRow(supabase: ReturnType<typeof createClient>): Promise<AlertConfigRow | null> {
  const { data, error } = await supabase
    .from('alert_config')
    .select('id, force_candle, double_pattern, engulfing')
    .order('id', { ascending: true })
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
    updated_at: new Date().toISOString(),
  }
  const table = supabase.from('alert_config')
  const { error } = row
    ? await table.update(values).eq('id', row.id)
    : await table.upsert(values, { onConflict: 'id', defaultToNull: false })
  if (error) throw error
}
