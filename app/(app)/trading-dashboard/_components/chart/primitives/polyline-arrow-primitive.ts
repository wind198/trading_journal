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
import { CHART_THEME } from '../../../_lib/chart/price-chart-style'

export type PolylineArrowDrawing = {
  id: string
  points: DrawingPoint[]
  label?: string
}

const LINE_COLOR = '#0052FF'
const SELECTED_COLOR = '#F0AD4E'
const DRAFT_COLOR = 'rgba(0, 82, 255, 0.55)'
const HIT_TOLERANCE = 8
const ANCHOR_HIT_RADIUS = 10
const ARROW_HEAD_LEN = 10
const LABEL_FONT = '11px system-ui, sans-serif'
const LABEL_OFFSET = 8
const MIN_ARROW_LEG_PX = 0.5

type SegmentGeom = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  draft: boolean
  selected: boolean
  isLast: boolean
  label?: string
  headX: number
  headY: number
  arrowFromX?: number
  arrowFromY?: number
  arrowToX?: number
  arrowToY?: number
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  selected: boolean,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const len = ARROW_HEAD_LEN * (selected ? 1.1 : 1)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(
    x2 - len * Math.cos(angle - Math.PI / 6),
    y2 - len * Math.sin(angle - Math.PI / 6),
  )
  ctx.lineTo(
    x2 - len * Math.cos(angle + Math.PI / 6),
    y2 - len * Math.sin(angle + Math.PI / 6),
  )
  ctx.closePath()
  ctx.fill()
}

class PolylineArrowRenderer {
  constructor(private segments: SegmentGeom[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      const byId = new Map<string, SegmentGeom[]>()
      for (const seg of this.segments) {
        const list = byId.get(seg.id) ?? []
        list.push(seg)
        byId.set(seg.id, list)
      }

      for (const [, segs] of byId) {
        if (segs.length === 0) continue
        const meta = segs[0]
        const color = meta.draft ? DRAFT_COLOR : meta.selected ? SELECTED_COLOR : LINE_COLOR
        context.strokeStyle = color
        context.lineWidth = meta.selected ? 2.5 : 1.5
        context.setLineDash(meta.draft ? [4, 3] : [])
        context.beginPath()
        context.moveTo(segs[0].x1, segs[0].y1)
        for (const seg of segs) {
          context.lineTo(seg.x2, seg.y2)
        }
        context.stroke()
        context.setLineDash([])

        const last = segs[segs.length - 1]
        if (last.isLast) {
          const fromX = last.arrowFromX ?? last.x1
          const fromY = last.arrowFromY ?? last.y1
          const toX = last.arrowToX ?? last.x2
          const toY = last.arrowToY ?? last.y2
          const legLen = Math.hypot(toX - fromX, toY - fromY)

          if (legLen >= MIN_ARROW_LEG_PX) {
            drawArrowHead(context, fromX, fromY, toX, toY, color, meta.selected)
          }

          const label = last.label?.trim()
          if (label) {
            const dx = legLen >= MIN_ARROW_LEG_PX ? toX - fromX : 1
            const dy = legLen >= MIN_ARROW_LEG_PX ? toY - fromY : 0
            const len = Math.hypot(dx, dy) || 1
            const ox = (dx / len) * LABEL_OFFSET
            const oy = (dy / len) * LABEL_OFFSET
            context.font = LABEL_FONT
            context.fillStyle = CHART_THEME.text
            context.textBaseline = 'middle'
            context.textAlign = dx >= 0 ? 'left' : 'right'
            context.fillText(label, toX + ox, toY + oy)
          }
        }

        if (meta.selected && !meta.draft) {
          for (const seg of segs) {
            context.beginPath()
            context.arc(seg.x2, seg.y2, 3.5, 0, Math.PI * 2)
            context.fillStyle = SELECTED_COLOR
            context.fill()
          }
        }
      }
    })
  }
}

type VertexGeom = {
  id: string
  index: number
  x: number
  y: number
}

class PolylineArrowPaneView {
  private rendererObj: PolylineArrowRenderer | null = null
  private segments: SegmentGeom[] = []
  private vertices: VertexGeom[] = []

  constructor(private source: PolylineArrowPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): PolylineArrowRenderer | null {
    return this.rendererObj
  }

  hitTestAnchor(x: number, y: number): { id: string; vertexIndex: number } | null {
    const anchorR = ANCHOR_HIT_RADIUS * this.source.hitBoost
    let best: { id: string; index: number; distance: number } | null = null
    for (const vertex of this.vertices) {
      const distance = Math.hypot(x - vertex.x, y - vertex.y)
      if (distance > anchorR) continue
      if (!best || distance < best.distance) {
        best = { id: vertex.id, index: vertex.index, distance }
      }
    }
    if (!best) return null
    return { id: best.id, vertexIndex: best.index }
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const tol = HIT_TOLERANCE * this.source.hitBoost
    let best: { id: string; distance: number } | null = null
    for (const seg of this.segments) {
      if (seg.draft) continue
      const distance = distToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2)
      if (distance > tol) continue
      if (!best || distance < best.distance) best = { id: seg.id, distance }
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
      this.vertices = []
      this.rendererObj = null
      return
    }

    const segments: SegmentGeom[] = []
    const vertices: VertexGeom[] = []

    const pushPolyline = (
      id: string,
      points: DrawingPoint[],
      draft: boolean,
      selected: boolean,
      label?: string,
    ) => {
      if (points.length < 2) return
      const coords: { x: number; y: number }[] = []
      const bars = this.source.bars
      for (const p of points) {
        const x = chartXAtTime(chart, p.time, bars)
        const y = series.priceToCoordinate(p.price)
        if (x == null || y == null) return
        coords.push({ x: Number(x), y: Number(y) })
      }
      if (selected && !draft) {
        coords.forEach((coord, index) => {
          vertices.push({ id, index, x: coord.x, y: coord.y })
        })
      }
      for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1]
        const curr = coords[i]
        const isLast = i === coords.length - 1
        segments.push({
          id,
          x1: prev.x,
          y1: prev.y,
          x2: curr.x,
          y2: curr.y,
          draft,
          selected,
          isLast,
          label: isLast ? label : undefined,
          headX: curr.x,
          headY: curr.y,
          ...(isLast
            ? {
                arrowFromX: prev.x,
                arrowFromY: prev.y,
                arrowToX: curr.x,
                arrowToY: curr.y,
              }
            : {}),
        })
      }
    }

    for (const poly of this.source.polylines) {
      pushPolyline(poly.id, poly.points, false, poly.id === this.source.selectedId, poly.label)
    }

    const draft = this.source.draft
    if (draft && draft.points.length >= 1) {
      const pts = draft.previewPoint
        ? [...draft.points, draft.previewPoint]
        : draft.points
      if (pts.length >= 2) {
        pushPolyline('draft', pts, true, false)
      } else if (pts.length === 1) {
        const x = chartXAtTime(chart, pts[0].time, this.source.bars)
        const y = series.priceToCoordinate(pts[0].price)
        if (x != null && y != null) {
          const nx = Number(x)
          const ny = Number(y)
          segments.push({
            id: 'draft',
            x1: nx,
            y1: ny,
            x2: nx,
            y2: ny,
            draft: true,
            selected: false,
            isLast: true,
            headX: nx,
            headY: ny,
          })
        }
      }
    }

    this.segments = segments
    this.vertices = vertices
    this.rendererObj = new PolylineArrowRenderer(segments)
  }
}

export class PolylineArrowPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  polylines: readonly PolylineArrowDrawing[] = []
  bars: BarTimeSeries = []
  draft: { points: DrawingPoint[]; previewPoint?: DrawingPoint } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  hitBoost = 1
  private requestUpdate: (() => void) | null = null
  private readonly paneView: PolylineArrowPaneView
  private readonly views: PolylineArrowPaneView[]

  constructor(polylines: readonly PolylineArrowDrawing[] = []) {
    this.polylines = polylines
    this.paneView = new PolylineArrowPaneView(this)
    this.views = [this.paneView]
  }

  setPolylines(polylines: readonly PolylineArrowDrawing[]): void {
    this.polylines = polylines
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
    this.requestUpdate?.()
  }

  setDraft(draft: { points: DrawingPoint[]; previewPoint?: DrawingPoint } | null): void {
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

  paneViews(): readonly PolylineArrowPaneView[] {
    return this.views
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    if (!this.selectionEnabled) return null
    return this.paneView.hitTest(x, y)
  }

  hitTestAnchor(x: number, y: number): { id: string; vertexIndex: number } | null {
    if (!this.selectionEnabled) return null
    return this.paneView.hitTestAnchor(x, y)
  }

  getDrawing(id: string): PolylineArrowDrawing | null {
    return this.polylines.find((p) => p.id === id) ?? null
  }
}
