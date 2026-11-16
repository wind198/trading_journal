import { isTextAnchorKind, type ChartDrawingKind, type DrawingPoint } from '../../_lib/chart/chart-drawings'
import { isChartIconKind } from '../../_lib/chart/chart-icons'
import type { ChartHandle } from './price-chart-handle'

type Draft = { p1: DrawingPoint; p2?: DrawingPoint; p3?: DrawingPoint }

const SHAPE_DRAFT_SCOPES = new Set([
  'trendline',
  'rectangle',
  'fibonacci_range',
  'fibonacci_range_extension',
  'warning_circle',
])

/** Routes a shape preview to its primitive without retaining placement state. */
export function applyShapeDraft(handle: ChartHandle, tool: ChartDrawingKind | null, draft: Draft | null): void {
  if (!tool || isChartIconKind(tool) || isTextAnchorKind(tool)) return
  if (!SHAPE_DRAFT_SCOPES.has(tool)) return
  handle.primitives.setDraft(tool, draft)
}

export function clearDrawingDrafts(handle: ChartHandle): void {
  handle.primitives.clearDrafts()
}
