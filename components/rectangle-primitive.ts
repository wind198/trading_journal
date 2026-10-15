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
import type { DrawingPoint } from '@/lib/chart-drawings'

export type RectangleDrawing = {
  id: string
  p1: DrawingPoint
  p2: DrawingPoint
}

const FILL = 'rgba(156, 163, 175, 0.22)'
const STROKE = 'rgba(107, 114, 128, 0.55)'
const SELECTED_STROKE = '#F0AD4E'
const DRAFT_FILL = 'rgba(156, 163, 175, 0.14)'
const DRAFT_STROKE = 'rgba(107, 114, 128, 0.45)'
const HIT_TOLERANCE = 6
const ANCHOR_HIT_RADIUS = 8

type RectGeom = {
  id: string
  left: number
  top: number
  right: number
  bottom: number
  ax1: number
  ay1: number
  ax2: number
  ay2: number
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

class RectangleRenderer {
  constructor(private rects: RectGeom[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const rect of this.rects) {
        const w = rect.right - rect.left
        const h = rect.bottom - rect.top
        context.beginPath()
        context.rect(rect.left, rect.top, w, h)
        context.fillStyle = rect.draft ? DRAFT_FILL : FILL
        context.fill()
        context.strokeStyle = rect.draft
          ? DRAFT_STROKE
          : rect.selected
            ? SELECTED_STROKE
            : STROKE
        context.lineWidth = rect.selected ? 2 : 1
        context.setLineDash(rect.draft ? [4, 3] : [])
        context.stroke()
        context.setLineDash([])
        if (rect.selected && !rect.draft) {
          const stroke = SELECTED_STROKE
          for (const [cx, cy] of [
            [rect.ax1, rect.ay1],
            [rect.ax2, rect.ay2],
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

class RectanglePaneView {
  private rendererObj: RectangleRenderer | null = null
  private rects: RectGeom[] = []

  constructor(private source: RectanglePrimitive) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  renderer(): RectangleRenderer | null {
    return this.rendererObj
  }

  hitTestAnchor(x: number, y: number): { id: string; endpoint: 'p1' | 'p2' } | null {
    for (const rect of this.rects) {
      if (rect.draft || !rect.selected) continue
      const d1 = Math.hypot(x - rect.ax1, y - rect.ay1)
      if (d1 <= ANCHOR_HIT_RADIUS) return { id: rect.id, endpoint: 'p1' }
      const d2 = Math.hypot(x - rect.ax2, y - rect.ay2)
      if (d2 <= ANCHOR_HIT_RADIUS) return { id: rect.id, endpoint: 'p2' }
    }
    return null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    let best: { id: string; distance: number } | null = null
    for (const rect of this.rects) {
      if (rect.draft) continue
      const { left, top, right, bottom } = rect
      const onBorder =
        Math.min(
          distToSegment(x, y, left, top, right, top),
          distToSegment(x, y, right, top, right, bottom),
          distToSegment(x, y, right, bottom, left, bottom),
          distToSegment(x, y, left, bottom, left, top),
        ) <= HIT_TOLERANCE
      const inside = x >= left && x <= right && y >= top && y <= bottom
      if (!onBorder && !inside) continue
      const distance = onBorder
        ? Math.min(
            distToSegment(x, y, left, top, right, top),
            distToSegment(x, y, right, top, right, bottom),
            distToSegment(x, y, right, bottom, left, bottom),
            distToSegment(x, y, left, bottom, left, top),
          )
        : 0
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
      this.rects = []
      this.rendererObj = null
      return
    }

    const rects: RectGeom[] = []
    const push = (
      id: string,
      p1: DrawingPoint,
      p2: DrawingPoint,
      draft: boolean,
      selected: boolean,
    ) => {
      const x1 = chart.timeScale().timeToCoordinate(p1.time as Time)
      const y1 = series.priceToCoordinate(p1.price)
      const x2 = chart.timeScale().timeToCoordinate(p2.time as Time)
      const y2 = series.priceToCoordinate(p2.price)
      if (x1 == null || y1 == null || x2 == null || y2 == null) return
      rects.push({
        id,
        left: Math.min(Number(x1), Number(x2)),
        top: Math.min(Number(y1), Number(y2)),
        right: Math.max(Number(x1), Number(x2)),
        bottom: Math.max(Number(y1), Number(y2)),
        ax1: Number(x1),
        ay1: Number(y1),
        ax2: Number(x2),
        ay2: Number(y2),
        draft,
        selected,
      })
    }

    for (const rect of this.source.rects) {
      push(rect.id, rect.p1, rect.p2, false, rect.id === this.source.selectedId)
    }
    const draft = this.source.draft
    if (draft?.p1 && draft.p2) {
      push('draft', draft.p1, draft.p2, true, false)
    } else if (draft?.p1) {
      const x = chart.timeScale().timeToCoordinate(draft.p1.time as Time)
      const y = series.priceToCoordinate(draft.p1.price)
      if (x != null && y != null) {
        const n = Number(x)
        const m = Number(y)
        rects.push({
          id: 'draft',
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

    this.rects = rects
    this.rendererObj = new RectangleRenderer(rects)
  }
}

export class RectanglePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  rects: readonly RectangleDrawing[] = []
  draft: { p1: DrawingPoint; p2?: DrawingPoint } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  private requestUpdate: (() => void) | null = null
  private readonly paneView: RectanglePaneView
  private readonly views: RectanglePaneView[]

  constructor(rects: readonly RectangleDrawing[] = []) {
    this.rects = rects
    this.paneView = new RectanglePaneView(this)
    this.views = [this.paneView]
  }

  setRects(rects: readonly RectangleDrawing[]): void {
    this.rects = rects
    this.requestUpdate?.()
  }

  setDraft(draft: { p1: DrawingPoint; p2?: DrawingPoint } | null): void {
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

  paneViews(): readonly RectanglePaneView[] {
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

  getDrawing(id: string): RectangleDrawing | null {
    return this.rects.find((rect) => rect.id === id) ?? null
  }
}
