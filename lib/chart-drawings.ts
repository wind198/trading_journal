import { createClient } from '@/lib/supabase/client'

export type ChartDrawingKind = 'trendline'

export type TrendlinePoint = {
  time: number
  price: number
}

export type ChartDrawing = {
  id: string
  symbol: string
  timeframe: string
  kind: ChartDrawingKind
  p1: TrendlinePoint
  p2: TrendlinePoint
}

type ChartDrawingRow = {
  id: string
  symbol: string
  timeframe: string
  kind: string
  p1_time: number
  p1_price: number
  p2_time: number
  p2_price: number
}

function rowToDrawing(row: ChartDrawingRow): ChartDrawing {
  return {
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    kind: row.kind as ChartDrawingKind,
    p1: { time: Number(row.p1_time), price: row.p1_price },
    p2: { time: Number(row.p2_time), price: row.p2_price },
  }
}

export async function loadChartDrawings(
  symbol: string,
  timeframe: string,
): Promise<ChartDrawing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('chart_drawings')
    .select('id, symbol, timeframe, kind, p1_time, p1_price, p2_time, p2_price')
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .eq('kind', 'trendline')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as ChartDrawingRow[] | null)?.map(rowToDrawing) ?? []
}

export async function insertTrendline(input: {
  symbol: string
  timeframe: string
  p1: TrendlinePoint
  p2: TrendlinePoint
}): Promise<ChartDrawing> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('chart_drawings')
    .insert([
      {
        user_id: user.id,
        symbol: input.symbol,
        timeframe: input.timeframe,
        kind: 'trendline',
        p1_time: Math.round(input.p1.time),
        p1_price: input.p1.price,
        p2_time: Math.round(input.p2.time),
        p2_price: input.p2.price,
      },
    ])
    .select('id, symbol, timeframe, kind, p1_time, p1_price, p2_time, p2_price')
    .single()
  if (error) throw error
  return rowToDrawing(data as ChartDrawingRow)
}

export async function deleteChartDrawing(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('chart_drawings').delete().eq('id', id)
  if (error) throw error
}
