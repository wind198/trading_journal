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
import type { TrendlinePoint } from '@/lib/chart-drawings'

export type TrendlineDrawing = {
  id: string
  p1: TrendlinePoint
  p2: TrendlinePoint
}

const LINE_COLOR = '#0052FF'
const SELECTED_COLOR = '#F0AD4E'
const DRAFT_COLOR = 'rgba(0, 82, 255, 0.55)'
const HIT_TOLERANCE = 6

type Segment = {
  id: string
  /** Line start (left / earlier). */
  x1: number
  y1: number
  /** Line end after rightward extension (2x segment length). */
  x2: number
  y2: number
  /** User anchors for markers (original p1/p2). */
  mx1: number
  my1: number
  mx2: number
  my2: number
  draft: boolean
  selected: boolean
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** Extend past the later-time point by one full segment → total drawn length 2x. */
function extendRight(p1: TrendlinePoint, p2: TrendlinePoint): {
  left: TrendlinePoint
  right: TrendlinePoint
  extended: TrendlinePoint
} {
  const left = p1.time <= p2.time ? p1 : p2
  const right = p1.time <= p2.time ? p2 : p1
  return {
    left,
    right,
    extended: {
      time: right.time + (right.time - left.time),
      price: right.price + (right.price - left.price),
    },
  }
}

class TrendlineRenderer {
  constructor(private segments: Segment[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const segment of this.segments) {
        const color = segment.draft ? DRAFT_COLOR : segment.selected ? SELECTED_COLOR : LINE_COLOR
        context.beginPath()
        context.moveTo(segment.x1, segment.y1)
        context.lineTo(segment.x2, segment.y2)
        context.strokeStyle = color
        context.lineWidth = segment.selected ? 2.5 : 1.5
        context.setLineDash(segment.draft ? [4, 3] : [])
        context.stroke()
        context.setLineDash([])
        for (const [x, y] of [
          [segment.mx1, segment.my1],
          [segment.mx2, segment.my2],
        ] as const) {
          context.beginPath()
          context.arc(x, y, segment.selected ? 4 : 3, 0, Math.PI * 2)
          context.fillStyle = color
          context.fill()
        }
      }
    })
  }
}

class TrendlinePaneView {
  private rendererObj: TrendlineRenderer | null = null
  private segments: Segment[] = []

  constructor(private source: TrendlinePrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): TrendlineRenderer | null {
    return this.rendererObj
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    let best: { id: string; distance: number } | null = null
    for (const segment of this.segments) {
      if (segment.draft) continue
      const distance = distToSegment(x, y, segment.x1, segment.y1, segment.x2, segment.y2)
      if (distance > HIT_TOLERANCE) continue
      if (!best || distance < best.distance) best = { id: segment.id, distance }
    }
    if (!best) return null
    return {
      externalId: best.id,
      zOrder: 'top',
      cursorStyle: 'pointer',
      distance: best.distance,
      hitTestPriority: 1,
    }
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series) {
      this.segments = []
      this.rendererObj = null
      return
    }

    const segments: Segment[] = []
    const push = (
      id: string,
      p1: TrendlinePoint,
      p2: TrendlinePoint,
      draft: boolean,
      selected: boolean,
    ) => {
      const { left, right, extended } = extendRight(p1, p2)
      const lx = chart.timeScale().timeToCoordinate(left.time as Time)
      const ly = series.priceToCoordinate(left.price)
      const rx = chart.timeScale().timeToCoordinate(right.time as Time)
      const ry = series.priceToCoordinate(right.price)
      const ax = chart.timeScale().timeToCoordinate(p1.time as Time)
      const ay = series.priceToCoordinate(p1.price)
      const bx = chart.timeScale().timeToCoordinate(p2.time as Time)
      const by = series.priceToCoordinate(p2.price)
      if (lx == null || ly == null || rx == null || ry == null || ax == null || ay == null || bx == null || by == null) {
        return
      }
      const exCoord = chart.timeScale().timeToCoordinate(extended.time as Time)
      const eyCoord = series.priceToCoordinate(extended.price)
      // Off-scale future time: extrapolate in pixel space (same geometry).
      const ex = exCoord == null ? rx + (rx - lx) : exCoord
      const ey = eyCoord == null ? ry + (ry - ly) : eyCoord
      segments.push({
        id,
        x1: Number(lx),
        y1: Number(ly),
        x2: Number(ex),
        y2: Number(ey),
        mx1: Number(ax),
        my1: Number(ay),
        mx2: Number(bx),
        my2: Number(by),
        draft,
        selected,
      })
    }

    for (const line of this.source.lines) {
      push(line.id, line.p1, line.p2, false, line.id === this.source.selectedId)
    }
    const draft = this.source.draft
    if (draft?.p1 && draft.p2) {
      push('draft', draft.p1, draft.p2, true, false)
    } else if (draft?.p1) {
      const x = chart.timeScale().timeToCoordinate(draft.p1.time as Time)
      const y = series.priceToCoordinate(draft.p1.price)
      if (x != null && y != null) {
        segments.push({
          id: 'draft',
          x1: x - 4,
          y1: y,
          x2: x + 4,
          y2: y,
          mx1: x,
          my1: y,
          mx2: x,
          my2: y,
          draft: true,
          selected: false,
        })
        segments.push({
          id: 'draft',
          x1: x,
          y1: y - 4,
          x2: x,
          y2: y + 4,
          mx1: x,
          my1: y,
          mx2: x,
          my2: y,
          draft: true,
          selected: false,
        })
      }
    }

    this.segments = segments
    this.rendererObj = new TrendlineRenderer(segments)
  }
}

export class TrendlinePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  lines: readonly TrendlineDrawing[] = []
  draft: { p1: TrendlinePoint; p2?: TrendlinePoint } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  private requestUpdate: (() => void) | null = null
  private readonly paneView: TrendlinePaneView
  private readonly views: TrendlinePaneView[]

  constructor(lines: readonly TrendlineDrawing[] = []) {
    this.lines = lines
    this.paneView = new TrendlinePaneView(this)
    this.views = [this.paneView]
  }

  setLines(lines: readonly TrendlineDrawing[]): void {
    this.lines = lines
    this.requestUpdate?.()
  }

  setDraft(draft: { p1: TrendlinePoint; p2?: TrendlinePoint } | null): void {
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

  paneViews(): readonly TrendlinePaneView[] {
    return this.views
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (!this.selectionEnabled) return null
    return this.paneView.hitTest(x, y)
  }
}
