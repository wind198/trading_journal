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
} from '../../../../../_lib/chart/candle-overlay-layout'
import type { BaselineDojiEvent } from '../../../../../_lib/overlays/baseline-indicators'
import { DOJI } from '../../../../../_lib/chart/price-chart-style'

export type DojiOverlayEvent = BaselineDojiEvent

type Marker = { cx: number; cy: number; size: number }

class DojiOverlayRenderer {
  constructor(private markers: Marker[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const marker of this.markers) {
        if (marker.size <= 0) continue
        const h = marker.size / 2
        const side = h * 0.75
        context.beginPath()
        context.moveTo(marker.cx, marker.cy - side)
        context.lineTo(marker.cx + side, marker.cy)
        context.lineTo(marker.cx, marker.cy + side)
        context.lineTo(marker.cx - side, marker.cy)
        context.closePath()
        context.fillStyle = DOJI.fill
        context.fill()
        context.strokeStyle = DOJI.stroke
        context.lineWidth = 1
        context.stroke()
      }
    })
  }
}

class DojiOverlayPaneView {
  private rendererObj: DojiOverlayRenderer | null = null

  constructor(private source: DojiOverlayPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): DojiOverlayRenderer | null {
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

      const { cx, cy, size } = overlayMarkerGeometry(
        Number(x),
        spacing,
        CANDLE_OVERLAY_STACK.doji,
        Number(yHigh),
        Number(yLow),
        true,
      )
      markers.push({ cx, cy, size })
    }

    this.rendererObj = markers.length > 0 ? new DojiOverlayRenderer(markers) : null
  }
}

export class DojiOverlayPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  events: readonly DojiOverlayEvent[] = []
  private requestUpdate: (() => void) | null = null
  private readonly paneView = new DojiOverlayPaneView(this)
  private readonly views = [this.paneView]

  setEvents(events: readonly DojiOverlayEvent[]): void {
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

  paneViews(): readonly DojiOverlayPaneView[] {
    return this.views
  }
}