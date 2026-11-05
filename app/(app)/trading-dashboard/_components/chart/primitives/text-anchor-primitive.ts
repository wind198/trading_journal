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

export type TextAnchorDrawing = {
  id: string
  p1: DrawingPoint
  label?: string
}

const TEXT_COLOR = CHART_THEME.text
const SELECTED_COLOR = '#F0AD4E'
const DRAFT_COLOR = 'rgba(0, 82, 255, 0.55)'
const ANCHOR_RADIUS = 3
const HIT_PADDING = 6
const ANCHOR_HIT_RADIUS = 10
const LABEL_FONT = '24px system-ui, sans-serif'
const LABEL_OFFSET_X = 8
const LABEL_OFFSET_Y = 4
const PLACEHOLDER = 'Text'

type TextGeom = {
  id: string
  x: number
  y: number
  text: string
  draft: boolean
  selected: boolean
  textWidth: number
  textHeight: number
}

function measureLabel(ctx: CanvasRenderingContext2D, text: string): { w: number; h: number } {
  ctx.font = LABEL_FONT
  const metrics = ctx.measureText(text)
  const w = metrics.width
  const h =
    (metrics.actualBoundingBoxAscent ?? 9) + (metrics.actualBoundingBoxDescent ?? 3) || 12
  return { w, h }
}

class TextAnchorRenderer {
  constructor(private items: readonly TextGeom[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const context = scope.context
      const hRatio = scope.horizontalPixelRatio
      const vRatio = scope.verticalPixelRatio
      for (const item of this.items) {
        const x = item.x * hRatio
        const y = item.y * vRatio
        const color = item.draft ? DRAFT_COLOR : item.selected ? SELECTED_COLOR : TEXT_COLOR
        context.fillStyle = color
        context.beginPath()
        context.arc(x, y, ANCHOR_RADIUS * hRatio * (item.selected ? 1.25 : 1), 0, Math.PI * 2)
        context.fill()

        context.font = LABEL_FONT
        context.textBaseline = 'top'
        context.fillStyle = color
        const tx = x + LABEL_OFFSET_X * hRatio
        const ty = y - LABEL_OFFSET_Y * vRatio - item.textHeight * vRatio
        context.fillText(item.text, tx, ty)

        if (item.selected && !item.draft) {
          context.strokeStyle = SELECTED_COLOR
          context.lineWidth = 1.5 * hRatio
          context.strokeRect(
            tx - 2 * hRatio,
            ty - 2 * vRatio,
            (item.textWidth + 4) * hRatio,
            (item.textHeight + 4) * vRatio,
          )
        }
      }
    })
  }
}

class TextAnchorPaneView {
  private rendererObj: TextAnchorRenderer | null = null
  private items: TextGeom[] = []

  constructor(private source: TextAnchorPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): TextAnchorRenderer | null {
    return this.rendererObj
  }

  hitTestAnchor(x: number, y: number): { id: string; endpoint: 'p1' | 'p2' } | null {
    const anchorR = ANCHOR_HIT_RADIUS * this.source.hitBoost
    for (const item of this.items) {
      if (item.draft || !item.selected) continue
      if (Math.hypot(x - item.x, y - item.y) <= anchorR) {
        return { id: item.id, endpoint: 'p1' }
      }
    }
    return null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const pad = HIT_PADDING * this.source.hitBoost
    let best: { id: string; distance: number } | null = null
    for (const item of this.items) {
      if (item.draft) continue
      const left = item.x + LABEL_OFFSET_X - pad
      const top = item.y - LABEL_OFFSET_Y - item.textHeight - pad
      const right = item.x + LABEL_OFFSET_X + item.textWidth + pad
      const bottom = item.y + ANCHOR_RADIUS + pad
      const inside =
        x >= Math.min(item.x - pad, left) &&
        x <= Math.max(item.x + pad, right) &&
        y >= Math.min(item.y - pad, top) &&
        y <= Math.max(item.y + pad, bottom)
      if (!inside) continue
      const distance = Math.hypot(x - item.x, y - item.y)
      if (!best || distance < best.distance) best = { id: item.id, distance }
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
      this.items = []
      this.rendererObj = null
      return
    }

    const measureCtx = document.createElement('canvas').getContext('2d')
    const items: TextGeom[] = []
    const push = (id: string, p1: DrawingPoint, label: string | undefined, draft: boolean, selected: boolean) => {
      const x = chartXAtTime(chart, p1.time, this.source.bars)
      const y = series.priceToCoordinate(p1.price)
      if (x == null || y == null) return
      const text = label?.trim() ? label : PLACEHOLDER
      const size = measureCtx
        ? measureLabel(measureCtx, text)
        : { w: text.length * 7, h: 12 }
      items.push({
        id,
        x: Number(x),
        y: Number(y),
        text,
        draft,
        selected,
        textWidth: size.w,
        textHeight: size.h,
      })
    }

    for (const item of this.source.anchors) {
      push(item.id, item.p1, item.label, false, item.id === this.source.selectedId)
    }
    const draft = this.source.draft
    if (draft) {
      push('draft', draft.p1, draft.label, true, false)
    }

    this.items = items
    this.rendererObj = new TextAnchorRenderer(items)
  }
}

export class TextAnchorPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  anchors: readonly TextAnchorDrawing[] = []
  bars: BarTimeSeries = []
  draft: { p1: DrawingPoint; label?: string } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  hitBoost = 1
  private requestUpdate: (() => void) | null = null
  private readonly paneView: TextAnchorPaneView
  private readonly views: TextAnchorPaneView[]

  constructor(anchors: readonly TextAnchorDrawing[] = []) {
    this.anchors = anchors
    this.paneView = new TextAnchorPaneView(this)
    this.views = [this.paneView]
  }

  setAnchors(anchors: readonly TextAnchorDrawing[]): void {
    this.anchors = anchors
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
    this.requestUpdate?.()
  }

  setDraft(draft: { p1: DrawingPoint; label?: string } | null): void {
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

  paneViews(): readonly TextAnchorPaneView[] {
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

  getDrawing(id: string): TextAnchorDrawing | null {
    return this.anchors.find((item) => item.id === id) ?? null
  }
}
