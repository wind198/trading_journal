import { createClient } from '@/lib/supabase/client'
import { CHART_ICON_KINDS, type ChartIconKind } from './chart-icons'

export type { ChartIconKind }
export type ShapeDrawingKind = 'trendline' | 'rectangle'
export type PolylineArrowKind = 'polyline_arrow'
export type ChartDrawingKind = ShapeDrawingKind | ChartIconKind | PolylineArrowKind

const LOADABLE_KINDS = [
  'trendline',
  'rectangle',
  'polyline_arrow',
  ...CHART_ICON_KINDS,
] as const

export type DrawingPoint = {
  time: number
  price: number
}

/** @deprecated Use DrawingPoint */
export type TrendlinePoint = DrawingPoint

export type ChartDrawing = {
  id: string
  symbol: string
  timeframe: string
  kind: ChartDrawingKind
  p1: DrawingPoint
  p2: DrawingPoint
  points?: DrawingPoint[]
  label?: string
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
  points?: unknown
  label?: string | null
}

const DRAWING_SELECT =
  'id, symbol, timeframe, kind, p1_time, p1_price, p2_time, p2_price, points, label'

function parsePointsJson(raw: unknown): DrawingPoint[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const points: DrawingPoint[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      'time' in item &&
      'price' in item &&
      typeof (item as { time: unknown }).time === 'number' &&
      typeof (item as { price: unknown }).price === 'number'
    ) {
      points.push({
        time: Number((item as { time: number }).time),
        price: Number((item as { price: number }).price),
      })
    }
  }
  return points.length > 0 ? points : undefined
}

function rowToDrawing(row: ChartDrawingRow): ChartDrawing {
  const points = parsePointsJson(row.points)
  return {
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    kind: row.kind as ChartDrawingKind,
    p1: { time: Number(row.p1_time), price: row.p1_price },
    p2: { time: Number(row.p2_time), price: row.p2_price },
    ...(points ? { points } : {}),
    ...(row.label != null ? { label: row.label } : {}),
  }
}

export function isPolylineArrowKind(kind: string): kind is PolylineArrowKind {
  return kind === 'polyline_arrow'
}

export async function loadChartDrawings(
  symbol: string,
  timeframe: string,
): Promise<ChartDrawing[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('chart_drawings')
    .select(DRAWING_SELECT)
    .eq('symbol', symbol)
    .eq('timeframe', timeframe)
    .in('kind', [...LOADABLE_KINDS])
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as ChartDrawingRow[] | null)?.map(rowToDrawing) ?? []
}

export async function insertDrawing(input: {
  symbol: string
  timeframe: string
  kind: ChartDrawingKind
  p1: DrawingPoint
  p2: DrawingPoint
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
        kind: input.kind,
        p1_time: Math.round(input.p1.time),
        p1_price: input.p1.price,
        p2_time: Math.round(input.p2.time),
        p2_price: input.p2.price,
      },
    ])
    .select(DRAWING_SELECT)
    .single()
  if (error) throw error
  return rowToDrawing(data as ChartDrawingRow)
}

export async function insertPolylineArrow(input: {
  symbol: string
  timeframe: string
  points: DrawingPoint[]
  label?: string
}): Promise<ChartDrawing> {
  if (input.points.length < 2) throw new Error('Polyline arrow requires at least 2 points')
  const first = input.points[0]
  const last = input.points[input.points.length - 1]
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
        kind: 'polyline_arrow',
        p1_time: Math.round(first.time),
        p1_price: first.price,
        p2_time: Math.round(last.time),
        p2_price: last.price,
        points: input.points.map((p) => ({ time: Math.round(p.time), price: p.price })),
        label: input.label ?? '',
      },
    ])
    .select(DRAWING_SELECT)
    .single()
  if (error) throw error
  return rowToDrawing(data as ChartDrawingRow)
}

export async function insertTrendline(input: {
  symbol: string
  timeframe: string
  p1: DrawingPoint
  p2: DrawingPoint
}): Promise<ChartDrawing> {
  return insertDrawing({ ...input, kind: 'trendline' })
}

export async function updateChartDrawing(
  id: string,
  points: { p1: DrawingPoint; p2: DrawingPoint },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('chart_drawings')
    .update({
      p1_time: Math.round(points.p1.time),
      p1_price: points.p1.price,
      p2_time: Math.round(points.p2.time),
      p2_price: points.p2.price,
    })
    .eq('id', id)
  if (error) throw error
}

export async function updatePolylineArrow(
  id: string,
  input: { points?: DrawingPoint[]; label?: string },
): Promise<void> {
  const supabase = createClient()
  const payload: Record<string, unknown> = {}
  if (input.points) {
    if (input.points.length < 2) throw new Error('Polyline arrow requires at least 2 points')
    const first = input.points[0]
    const last = input.points[input.points.length - 1]
    payload.p1_time = Math.round(first.time)
    payload.p1_price = first.price
    payload.p2_time = Math.round(last.time)
    payload.p2_price = last.price
    payload.points = input.points.map((p) => ({
      time: Math.round(p.time),
      price: p.price,
    }))
  }
  if (input.label !== undefined) payload.label = input.label
  if (Object.keys(payload).length === 0) return
  const { error } = await supabase.from('chart_drawings').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteChartDrawing(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('chart_drawings').delete().eq('id', id)
  if (error) throw error
}
