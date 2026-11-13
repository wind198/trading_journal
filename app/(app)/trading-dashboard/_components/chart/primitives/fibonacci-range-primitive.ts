import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitiveHoveredItem,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { chartXAtTime, type BarTimeSeries } from '../../../_lib/chart/chart-coordinates'
import type { DrawingPoint } from '../../../_lib/chart/chart-drawings'

export type FibonacciRangeDrawing = {
  id: string
  p1: DrawingPoint
  p2: DrawingPoint
  p3?: DrawingPoint
}

const LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
const EXTENSION_LEVELS = [1, 1.236, 1.382, 1.5, 1.618, 1.786, 2]
const COLORS = ['#9ca3af', '#ef5350', '#ff9800', '#26a69a', '#2196f3', '#7e57c2', '#9ca3af']

const SELECTED_STROKE = '#F0AD4E'
const DRAFT_STROKE = 'rgba(107, 114, 128, 0.45)'
const HIT_TOLERANCE = 6
const ANCHOR_HIT_RADIUS = 8

type RangeGeometry = {
  id: string
  left: number
  top: number
  right: number
  bottom: number
  ax1: number
  ay1: number
  ax2: number
  ay2: number
  third?: { x: number; y: number }
  draft: boolean
  selected: boolean
  levels: { ratio: number; price: number; y: number }[]
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

class FibonacciRangeRenderer {
  constructor(private ranges: RangeGeometry[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const rect of this.ranges) {
        context.save()
        context.font = '11px sans-serif'
        context.textAlign = 'right'
        for (let i = 0; i < rect.levels.length; i++) {
          const level = rect.levels[i]
          const color = COLORS[i]
          const previous = rect.levels[i - 1]
          if (previous) {
            context.globalAlpha = rect.draft ? 0.04 : 0.08
            context.fillStyle = color
            context.fillRect(rect.left, Math.min(previous.y, level.y), rect.right - rect.left, Math.abs(level.y - previous.y))
          }
          context.globalAlpha = rect.draft ? 0.55 : 1
          context.strokeStyle = rect.selected ? SELECTED_STROKE : color
          context.lineWidth = rect.selected ? 1.5 : 1
          context.setLineDash(rect.draft ? [4, 3] : [])
          context.beginPath()
          context.moveTo(rect.left, level.y)
          context.lineTo(rect.right, level.y)
          context.stroke()
          context.fillStyle = color
          context.fillText(`${level.ratio} (${level.price.toLocaleString(undefined, { maximumSignificantDigits: 8 })})`, rect.right - 5, level.y - 4)
        }
        context.globalAlpha = 0.65
        context.strokeStyle = SELECTED_STROKE
        context.setLineDash([4, 4])
        context.beginPath()
        context.moveTo(rect.ax1, rect.ay1)
        context.lineTo(rect.ax2, rect.ay2)
        if (rect.third) context.lineTo(rect.third.x, rect.third.y)
        context.stroke()
        context.restore()
        if (rect.selected || rect.draft) {
          const stroke = rect.draft ? DRAFT_STROKE : SELECTED_STROKE
          for (const [cx, cy] of [
            [rect.ax1, rect.ay1],
            [rect.ax2, rect.ay2],
            ...(rect.third ? [[rect.third.x, rect.third.y] as const] : []),
          ] as const) {
            context.beginPath()
            context.arc(cx, cy, 4, 0, Math.PI * 2)
            context.fillStyle = stroke
            context.fill()
          }
        }
      }
    })
  }
}

class FibonacciRangePaneView {
  private rendererObj: FibonacciRangeRenderer | null = null
  private ranges: RangeGeometry[] = []

  constructor(private source: FibonacciRangePrimitive) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  renderer(): FibonacciRangeRenderer | null {
    return this.rendererObj
  }

  hitTestThirdAnchor(x: number, y: number): { id: string; vertexIndex: number } | null {
    for (const range of this.ranges) {
      if (!range.selected || range.draft || !range.third) continue
      if (Math.hypot(x - range.third.x, y - range.third.y) <= ANCHOR_HIT_RADIUS * this.source.hitBoost) {
        return { id: range.id, vertexIndex: 2 }
      }
    }
    return null
  }

  hitTestAnchor(x: number, y: number): { id: string; endpoint: 'p1' | 'p2' } | null {
    const anchorR = ANCHOR_HIT_RADIUS * this.source.hitBoost
    for (const rect of this.ranges) {
      if (rect.draft || !rect.selected) continue
      const d1 = Math.hypot(x - rect.ax1, y - rect.ay1)
      if (d1 <= anchorR) return { id: rect.id, endpoint: 'p1' }
      const d2 = Math.hypot(x - rect.ax2, y - rect.ay2)
      if (d2 <= anchorR) return { id: rect.id, endpoint: 'p2' }
    }
    return null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const borderTol = HIT_TOLERANCE * this.source.hitBoost
    let best: { id: string; distance: number } | null = null
    for (const rect of this.ranges) {
      if (rect.draft) continue
      const distance = Math.min(
        ...rect.levels.map((level) => distToSegment(x, y, rect.left, level.y, rect.right, level.y)),
        distToSegment(x, y, rect.ax1, rect.ay1, rect.ax2, rect.ay2),
        ...(rect.third ? [distToSegment(x, y, rect.ax2, rect.ay2, rect.third.x, rect.third.y)] : []),
      )
      if (distance > borderTol) continue
      if (!best || distance < best.distance) best = { id: rect.id, distance }
    }
    if (!best) return null
    return {
      externalId: best.id,
      zOrder: 'bottom',
      cursorStyle: 'pointer',
      distance: best.distance,
      hitTestPriority: best.distance === 0 ? 0 : 1,
    }
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series) {
      this.ranges = []
      this.rendererObj = null
      return
    }

    const ranges: RangeGeometry[] = []
    const push = (
      id: string,
      p1: DrawingPoint,
      p2: DrawingPoint,
      draft: boolean,
      selected: boolean,
      p3?: DrawingPoint,
    ) => {
      const bars = this.source.bars
      const x1 = chartXAtTime(chart, p1.time, bars)
      const y1 = series.priceToCoordinate(p1.price)
      const x2 = chartXAtTime(chart, p2.time, bars)
      const y2 = series.priceToCoordinate(p2.price)
      if (x1 == null || y1 == null || x2 == null || y2 == null) return
      const x3 = p3 ? chartXAtTime(chart, p3.time, bars) : null
      const y3 = p3 ? series.priceToCoordinate(p3.price) : null
      if (p3 && (x3 == null || y3 == null)) return
      ranges.push({
        third: x3 != null && y3 != null ? { x: Number(x3), y: Number(y3) } : undefined,
        id,
        levels: (this.source.extension && !p3 ? [] : this.source.extension ? EXTENSION_LEVELS : LEVELS).map((ratio) => {
          const price = p3 ? p3.price + ratio * (p2.price - p1.price) : p2.price + ratio * (p1.price - p2.price)
          const y = series.priceToCoordinate(price)
          return { ratio, price, y: y == null ? null : Number(y) }
        }).filter((level): level is { ratio: number; price: number; y: number } => level.y != null),
        left: p3 && x3 != null ? Number(x3) : Math.min(Number(x1), Number(x2)),
        top: Math.min(Number(y1), Number(y2)),
        // Extend one anchor span past the rightmost anchor: total width is 2× the span.
        right: p3 && x3 != null
          ? Number(x3) + 2 * Math.abs(Number(x2) - Number(x1))
          : Math.max(Number(x1), Number(x2)) + Math.abs(Number(x2) - Number(x1)),
        bottom: Math.max(Number(y1), Number(y2)),
        ax1: Number(x1),
        ay1: Number(y1),
        ax2: Number(x2),
        ay2: Number(y2),
        draft,
        selected,
      })
    }

    for (const rect of this.source.ranges) {
      push(rect.id, rect.p1, rect.p2, false, rect.id === this.source.selectedId, rect.p3)
    }
    const draft = this.source.draft
    if (draft?.p1 && draft.p2) {
      push('draft', draft.p1, draft.p2, true, false, draft.p3)
    } else if (draft?.p1) {
      const x = chartXAtTime(chart, draft.p1.time, this.source.bars)
      const y = series.priceToCoordinate(draft.p1.price)
      if (x != null && y != null) {
        const n = Number(x)
        const m = Number(y)
        ranges.push({
          id: 'draft',
          levels: [],
          left: n - 3,
          top: m - 3,
          right: n + 3,
          bottom: m + 3,
          ax1: n,
          ay1: m,
          ax2: n,
          ay2: m,
          draft: true,
          selected: false,
        })
      }
    }

    this.ranges = ranges
    this.rendererObj = new FibonacciRangeRenderer(ranges)
  }
}

export class FibonacciRangePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  ranges: readonly FibonacciRangeDrawing[] = []
  bars: BarTimeSeries = []
  draft: { p1: DrawingPoint; p2?: DrawingPoint; p3?: DrawingPoint } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  hitBoost = 1
  private requestUpdate: (() => void) | null = null
  private readonly paneView: FibonacciRangePaneView
  private readonly views: FibonacciRangePaneView[]

  constructor(ranges: readonly FibonacciRangeDrawing[] = [], readonly extension = false) {
    this.ranges = ranges
    this.paneView = new FibonacciRangePaneView(this)
    this.views = [this.paneView]
  }

  setRanges(ranges: readonly FibonacciRangeDrawing[]): void {
    this.ranges = ranges
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
    this.requestUpdate?.()
  }

  setDraft(draft: { p1: DrawingPoint; p2?: DrawingPoint; p3?: DrawingPoint } | null): void {
    this.draft = draft
    this.requestUpdate?.()
  }

  setSelectedId(id: string | null): void {
    this.selectedId = id
    this.requestUpdate?.()
  }

  setSelectionEnabled(enabled: boolean): void {
    this.selectionEnabled = enabled
  }

  setHitBoost(boost: number): void {
    this.hitBoost = boost
    this.requestUpdate?.()
  }

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached(): void {
    this.chart = null
    this.series = null
    this.requestUpdate = null
  }

  updateAllViews(): void {
    this.paneView.update()
  }

  paneViews(): readonly FibonacciRangePaneView[] {
    return this.views
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (!this.selectionEnabled) return null
    return this.paneView.hitTest(x, y)
  }

  hitTestAnchor(x: number, y: number): { id: string; endpoint: 'p1' | 'p2' } | null {
    if (!this.selectionEnabled) return null
    return this.paneView.hitTestAnchor(x, y)
  }

  hitTestExtensionAnchor(x: number, y: number): { id: string; vertexIndex: number } | null {
    if (!this.selectionEnabled) return null
    const third = this.paneView.hitTestThirdAnchor(x, y)
    if (third) return third
    const anchor = this.paneView.hitTestAnchor(x, y)
    return anchor ? { id: anchor.id, vertexIndex: anchor.endpoint === 'p1' ? 0 : 1 } : null
  }

  getDrawing(id: string): FibonacciRangeDrawing | null {
    return this.ranges.find((rect) => rect.id === id) ?? null
  }
}
