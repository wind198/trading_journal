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
import {
  resolveChartIconVariant,
  type ChartIconDirection,
  type ChartIconFamily,
  type ChartIconKind,
} from '../../../_lib/chart/chart-icons'

export type IconMarkerDrawing = {
  id: string
  kind: ChartIconKind
  p1: DrawingPoint
}

const SELECTED_RING = '#F0AD4E'
const HIT_RADIUS = 12
const ANCHOR_HIT_RADIUS = 10
const ICON_SIZE = 11

type IconGeom = {
  id: string
  kind: ChartIconKind
  x: number
  y: number
  draft: boolean
  selected: boolean
}

function withIconOrientation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: ChartIconDirection,
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
) {
  ctx.save()
  if (direction === 'down') {
    ctx.translate(x, y)
    ctx.scale(1, -1)
    ctx.translate(-x, -y)
  }
  draw(ctx, x, y)
  ctx.restore()
}

function drawStrongPush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  selected: boolean,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = selected ? 3 : 2.5
  ctx.beginPath()
  ctx.moveTo(x, y + 8)
  ctx.lineTo(x, y - 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 7, y + 1)
  ctx.lineTo(x, y - 8)
  ctx.lineTo(x + 7, y + 1)
  ctx.closePath()
  ctx.fill()
}

function drawWeakeningTrend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  selected: boolean,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = selected ? 2.5 : 2
  ctx.setLineDash([3, 2])
  ctx.beginPath()
  ctx.moveTo(x - 9, y - 6)
  ctx.lineTo(x + 9, y + 6)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + 5, y + 2)
  ctx.lineTo(x + 9, y + 6)
  ctx.lineTo(x + 5, y + 6)
  ctx.closePath()
  ctx.fill()
}

function drawWeakReaction(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  selected: boolean,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = selected ? 2 : 1.5
  ctx.beginPath()
  ctx.arc(x - 4, y + 2, 3, Math.PI, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + 4, y - 2, 2.5, Math.PI, 0)
  ctx.stroke()
}

function drawResistanceTest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  selected: boolean,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = selected ? 2.5 : 2
  ctx.beginPath()
  ctx.moveTo(x - 10, y - 6)
  ctx.lineTo(x + 10, y - 6)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + 7)
  ctx.lineTo(x, y - 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 5, y - 2)
  ctx.lineTo(x, y - 8)
  ctx.lineTo(x + 5, y - 2)
  ctx.closePath()
  ctx.fill()
}

function drawFamilyGlyph(
  ctx: CanvasRenderingContext2D,
  family: ChartIconFamily,
  x: number,
  y: number,
  selected: boolean,
  color: string,
) {
  switch (family) {
    case 'strong_push':
      drawStrongPush(ctx, x, y, selected, color)
      break
    case 'weakening_trend':
      drawWeakeningTrend(ctx, x, y, selected, color)
      break
    case 'weak_reaction':
      drawWeakReaction(ctx, x, y, selected, color)
      break
    case 'resistance_test':
      drawResistanceTest(ctx, x, y, selected, color)
      break
  }
}

function drawIconGlyph(
  ctx: CanvasRenderingContext2D,
  kind: ChartIconKind,
  x: number,
  y: number,
  selected: boolean,
) {
  const { family, direction, color } = resolveChartIconVariant(kind)
  withIconOrientation(ctx, x, y, direction, (orientedCtx, ox, oy) => {
    drawFamilyGlyph(orientedCtx, family, ox, oy, selected, color)
  })
}

class IconMarkerRenderer {
  constructor(private icons: IconGeom[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const icon of this.icons) {
        if (icon.selected && !icon.draft) {
          context.beginPath()
          context.arc(icon.x, icon.y, ICON_SIZE + 4, 0, Math.PI * 2)
          context.strokeStyle = SELECTED_RING
          context.lineWidth = 2
          context.stroke()
        }
        drawIconGlyph(context, icon.kind, icon.x, icon.y, icon.selected)
        if (icon.selected && !icon.draft) {
          context.beginPath()
          context.arc(icon.x, icon.y, 4, 0, Math.PI * 2)
          context.fillStyle = SELECTED_RING
          context.fill()
        }
      }
    })
  }
}

class IconMarkerPaneView {
  private rendererObj: IconMarkerRenderer | null = null
  private icons: IconGeom[] = []

  constructor(private source: IconMarkerPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): IconMarkerRenderer | null {
    return this.rendererObj
  }

  hitTestAnchor(x: number, y: number): { id: string; endpoint: 'p1' | 'p2' } | null {
    const anchorR = ANCHOR_HIT_RADIUS * this.source.hitBoost
    for (const icon of this.icons) {
      if (icon.draft || !icon.selected) continue
      if (Math.hypot(x - icon.x, y - icon.y) <= anchorR) {
        return { id: icon.id, endpoint: 'p1' }
      }
    }
    return null
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const hitR = HIT_RADIUS * this.source.hitBoost
    let best: { id: string; distance: number } | null = null
    for (const icon of this.icons) {
      if (icon.draft) continue
      const distance = Math.hypot(x - icon.x, y - icon.y)
      if (distance > hitR) continue
      if (!best || distance < best.distance) best = { id: icon.id, distance }
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
      this.icons = []
      this.rendererObj = null
      return
    }

    const icons: IconGeom[] = []
    const push = (
      id: string,
      kind: ChartIconKind,
      p1: DrawingPoint,
      draft: boolean,
      selected: boolean,
    ) => {
      const x = chartXAtTime(chart, p1.time, this.source.bars)
      const y = series.priceToCoordinate(p1.price)
      if (x == null || y == null) return
      icons.push({
        id,
        kind,
        x: Number(x),
        y: Number(y),
        draft,
        selected,
      })
    }

    for (const icon of this.source.icons) {
      push(icon.id, icon.kind, icon.p1, false, icon.id === this.source.selectedId)
    }
    const draft = this.source.draft
    if (draft) {
      push('draft', draft.kind, draft.p1, true, false)
    }

    this.icons = icons
    this.rendererObj = new IconMarkerRenderer(icons)
  }
}

export class IconMarkerPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  icons: readonly IconMarkerDrawing[] = []
  bars: BarTimeSeries = []
  draft: { kind: ChartIconKind; p1: DrawingPoint } | null = null
  selectedId: string | null = null
  selectionEnabled = true
  hitBoost = 1
  private requestUpdate: (() => void) | null = null
  private readonly paneView: IconMarkerPaneView
  private readonly views: IconMarkerPaneView[]

  constructor(icons: readonly IconMarkerDrawing[] = []) {
    this.icons = icons
    this.paneView = new IconMarkerPaneView(this)
    this.views = [this.paneView]
  }

  setIcons(icons: readonly IconMarkerDrawing[]): void {
    this.icons = icons
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
    this.requestUpdate?.()
  }

  setDraft(draft: { kind: ChartIconKind; p1: DrawingPoint } | null): void {
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

  paneViews(): readonly IconMarkerPaneView[] {
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

  getDrawing(id: string): IconMarkerDrawing | null {
    return this.icons.find((icon) => icon.id === id) ?? null
  }
}
