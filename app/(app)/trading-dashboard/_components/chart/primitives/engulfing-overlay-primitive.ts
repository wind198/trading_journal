import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import {
  CANDLE_OVERLAY_STACK,
  overlayMarkerGeometry,
} from '../../../_lib/chart/candle-overlay-layout'
import {
  EngulfingDirection,
  type EngulfingEvent,
} from '../../../_lib/overlays/engulfing'
import { ENGULFING } from '../../../_lib/chart/price-chart-style'

export type EngulfingOverlayEvent = Pick<
  EngulfingEvent,
  'time' | 'direction' | 'srcOpen' | 'srcHigh' | 'srcLow' | 'srcClose'
>

type Marker = {
  cx: number
  cy: number
  size: number
  fill: string
  /** true = point up (bullish), false = point down (bearish) */
  pointUp: boolean
}

class EngulfingOverlayRenderer {
  constructor(private markers: Marker[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const marker of this.markers) {
        if (marker.size <= 0) continue
        const h = marker.size / 2
        context.beginPath()
        if (marker.pointUp) {
          context.moveTo(marker.cx, marker.cy - h)
          context.lineTo(marker.cx + h, marker.cy + h)
          context.lineTo(marker.cx - h, marker.cy + h)
        } else {
          context.moveTo(marker.cx, marker.cy + h)
          context.lineTo(marker.cx + h, marker.cy - h)
          context.lineTo(marker.cx - h, marker.cy - h)
        }
        context.closePath()
        context.fillStyle = marker.fill
        context.fill()
      }
    })
  }
}

class EngulfingOverlayPaneView {
  private rendererObj: EngulfingOverlayRenderer | null = null

  constructor(private source: EngulfingOverlayPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): EngulfingOverlayRenderer | null {
    return this.rendererObj
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series) {
      this.rendererObj = null
      return
    }

    const spacing = chart.timeScale().options().barSpacing
    const markers: Marker[] = []

    for (const event of this.source.events) {
      const x = chart.timeScale().timeToCoordinate(event.time as Time)
      const yHigh = series.priceToCoordinate(event.srcHigh)
      const yLow = series.priceToCoordinate(event.srcLow)
      if (x == null || yHigh == null || yLow == null) continue

      const bullish = event.direction === EngulfingDirection.Bullish
      const { cx, cy, size } = overlayMarkerGeometry(
        Number(x),
        spacing,
        CANDLE_OVERLAY_STACK.engulfing,
        Number(yHigh),
        Number(yLow),
        bullish,
      )
      markers.push({
        cx,
        cy,
        size,
        fill: bullish ? ENGULFING.bullish : ENGULFING.bearish,
        pointUp: bullish,
      })
    }

    this.rendererObj = new EngulfingOverlayRenderer(markers)
  }
}

export class EngulfingOverlayPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  events: readonly EngulfingOverlayEvent[] = []
  private requestUpdate: (() => void) | null = null
  private readonly paneView: EngulfingOverlayPaneView
  private readonly views: EngulfingOverlayPaneView[]

  constructor(events: readonly EngulfingOverlayEvent[] = []) {
    this.events = events
    this.paneView = new EngulfingOverlayPaneView(this)
    this.views = [this.paneView]
  }

  setEvents(events: readonly EngulfingOverlayEvent[]): void {
    this.events = events
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

  paneViews(): readonly EngulfingOverlayPaneView[] {
    return this.views
  }
}
