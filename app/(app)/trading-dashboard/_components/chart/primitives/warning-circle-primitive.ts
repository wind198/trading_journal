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

export type WarningCircleDrawing = {
  id: string
  /** Center */
  p1: DrawingPoint
  /** Rim point — radius is screen distance from center */
  p2: DrawingPoint
  label?: string
}

const FILL = 'rgba(245, 158, 11, 0.28)'
const STROKE = 'rgba(245, 158, 11, 0.7)'
const SELECTED_STROKE = '#F0AD4E'
const DRAFT_FILL = 'rgba(245, 158, 11, 0.16)'
const DRAFT_STROKE = 'rgba(245, 158, 11, 0.5)'
const HIT_TOLERANCE = 6
const ANCHOR_HIT_RADIUS = 8
const MIN_RADIUS = 4
const LABEL_FONT = '11px system-ui, sans-serif'

type CircleGeom = {
  id: string
  cx: number
  cy: number
  rx: number
  ry: number
  radius: number
  draft: boolean
  selected: boolean
  label?: string
}

class WarningCircleRenderer {
  constructor(private circles: CircleGeom[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const circle of this.circles) {
        if (circle.radius < 0.5) continue
        context.beginPath()
        context.arc(circle.cx, circle.cy, circle.radius, 0, Math.PI * 2)
        context.fillStyle = circle.draft ? DRAFT_FILL : FILL
        context.fill()
        context.strokeStyle = circle.draft
          ? DRAFT_STROKE
          : circle.selected
            ? SELECTED_STROKE
            : STROKE
        context.lineWidth = circle.selected ? 2 : 1.25
        context.setLineDash(circle.draft ? [4, 3] : [])
        context.stroke()
        context.setLineDash([])

        const label = circle.label?.trim()
        if (label) {
          context.font = LABEL_FONT
          context.fillStyle = CHART_THEME.text
          context.textBaseline = 'middle'
          context.textAlign = 'center'
          context.fillText(label, circle.cx, circle.cy)
        }

        if (circle.selected && !circle.draft) {
          for (const [ax, ay] of [
            [circle.cx, circle.cy],
            [circle.rx, circle.ry],
          ] as const) {
            context.beginPath()
            context.arc(ax, ay, 4, 0, Math.PI * 2)
            context.fillStyle = SELECTED_STROKE
            context.fill()
          }
        }
      }
    })
  }
}

class WarningCirclePaneView {
  private rendererObj: WarningCircleRenderer | null = null
  private circles: CircleGeom[] = []

  constructor(private source: WarningCirclePrimitive) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  renderer(): WarningCircleRenderer | null {
    return this.rendererObj
  }

  hitTestAnchor(x: number, y: number): { id: string; endpoint: 'p1' | 'p2' } | null {
    const anchorR = ANCHOR_HIT_RADIUS * this.source.hitBoost
    for (const circle of this.circles) {
      if (circle.draft || !circle.selected) continue
      if (Math.hypot(x - circle.cx, y - circle.cy) <= anchorR) {
        return { id: circle.id, endpoint: 'p1' }
      }
      if (Math.hypot(x - circle.rx, y - circle.ry) <= anchorR) {
        return { id: circle.id, endpoint: 'p2' }
      }
    }
    return null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const borderTol = HIT_TOLERANCE * this.source.hitBoost
    let best: { id: string; distance: number } | null = null
    for (const circle of this.circles) {
      if (circle.draft) continue
      const dist = Math.hypot(x - circle.cx, y - circle.cy)
      const onRim = Math.abs(dist - circle.radius) <= borderTol
      const inside = dist <= circle.radius
      if (!onRim && !inside) continue
      const distance = onRim ? Math.abs(dist - circle.radius) : 0
      if (!best || distance < best.distance) best = { id: circle.id, distance }
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
      this.circles = []
      this.rendererObj = null
      return
    }

    const circles: CircleGeom[] = []
    const push = (
      id: string,
      p1: DrawingPoint,
      p2: DrawingPoint,
      draft: boolean,
      selected: boolean,
      label?: string,
    ) => {
      const bars = this.source.bars
      const x1 = chartXAtTime(chart, p1.time, bars)
      const y1 = series.priceToCoordinate(p1.price)
      const x2 = chartXAtTime(chart, p2.time, bars)
      const y2 = series.priceToCoordinate(p2.price)
      if (x1 == null || y1 == null || x2 == null || y2 == null) return
      const cx = Number(x1)
      const cy = Number(y1)
      const rx = Number(x2)
      const ry = Number(y2)
      circles.push({
        id,
        cx,
        cy,
        rx,
        ry,
        radius: Math.max(MIN_RADIUS, Math.hypot(rx - cx, ry - cy)),
        draft,
        selected,
        label,
      })
    }

    for (const circle of this.source.circles) {
      push(
        circle.id,
        circle.p1,
        circle.p2,
        false,
        circle.id === this.source.selectedId,
        circle.label,
      )
    }
    const draft = this.source.draft
    if (draft?.p1 && draft.p2) {
      push('draft', draft.p1, draft.p2, true, false, draft.label)
    } else if (draft?.p1) {
      const x = chartXAtTime(chart, draft.p1.time, this.source.bars)
      const y = series.priceToCoordinate(draft.p1.price)
      if (x != null && y != null) {
        const cx = Number(x)
        const cy = Number(y)
        circles.push({
          id: 'draft',
          cx,
          cy,
          rx: cx + MIN_RADIUS,
          ry: cy,
          radius: MIN_RADIUS,
          draft: true,
          selected: false,
          label: draft.label,
        })
      }
    }

    this.circles = circles
    this.rendererObj = new WarningCircleRenderer(circles)
  }
}

export class WarningCirclePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  circles: readonly WarningCircleDrawing[] = []
  bars: BarTimeSeries = []
  draft: { p1: DrawingPoint; p2?: DrawingPoint; label?: string } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  hitBoost = 1
  private requestUpdate: (() => void) | null = null
  private readonly paneView: WarningCirclePaneView
  private readonly views: WarningCirclePaneView[]

  constructor(circles: readonly WarningCircleDrawing[] = []) {
    this.circles = circles
    this.paneView = new WarningCirclePaneView(this)
    this.views = [this.paneView]
  }

  setCircles(circles: readonly WarningCircleDrawing[]): void {
    this.circles = circles
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
    this.requestUpdate?.()
  }

  setDraft(draft: { p1: DrawingPoint; p2?: DrawingPoint; label?: string } | null): void {
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

  paneViews(): readonly WarningCirclePaneView[] {
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

  getDrawing(id: string): WarningCircleDrawing | null {
    return this.circles.find((circle) => circle.id === id) ?? null
  }
}
