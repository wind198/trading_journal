import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { PEAK_DETECTION } from '../../../_lib/chart/price-chart-style'
import type { PeakKind } from '../../../_lib/overlays/peak-detection'
import { chartXAtTime, type BarTimeSeries } from '../../../_lib/chart/chart-coordinates'

export type PeakOverlayEvent = {
  time: number
  price: number
  kind: PeakKind
}

type Marker = {
  cx: number
  cy: number
  size: number
  fill: string
  kind: PeakKind
}

class PeakOverlayRenderer {
  constructor(private markers: Marker[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const m of this.markers) {
        if (m.size <= 0) continue
        const h = m.size / 2
        context.beginPath()
        if (m.kind === 'peak') {
          // ▼ peak
          context.moveTo(m.cx, m.cy + h)
          context.lineTo(m.cx + h, m.cy - h)
          context.lineTo(m.cx - h, m.cy - h)
        } else {
          // ▲ trough
          context.moveTo(m.cx, m.cy - h)
          context.lineTo(m.cx + h, m.cy + h)
          context.lineTo(m.cx - h, m.cy + h)
        }
        context.closePath()
        context.fillStyle = m.fill
        context.fill()
      }
    })
  }
}

class PeakOverlayPaneView {
  private rendererObj: PeakOverlayRenderer | null = null

  constructor(private source: PeakOverlayPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): PeakOverlayRenderer | null {
    return this.rendererObj
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series || this.source.events.length === 0) {
      this.rendererObj = null
      return
    }

    const spacing = chart.timeScale().options().barSpacing
    const size = Math.max(6, spacing * 0.55)
    const markers: Marker[] = []

    for (const event of this.source.events) {
      const x = chartXAtTime(chart, event.time, this.source.bars)
      const y = series.priceToCoordinate(event.price)
      if (x == null || y == null) continue
      markers.push({
        cx: Number(x),
        cy: Number(y),
        size,
        fill: event.kind === 'peak' ? PEAK_DETECTION.peak : PEAK_DETECTION.trough,
        kind: event.kind,
      })
    }

    this.rendererObj = new PeakOverlayRenderer(markers)
  }
}

export class PeakOverlayPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  events: readonly PeakOverlayEvent[] = []
  bars: BarTimeSeries = []
  private requestUpdate: (() => void) | null = null
  private readonly paneView: PeakOverlayPaneView
  private readonly views: PeakOverlayPaneView[]

  constructor(events: readonly PeakOverlayEvent[] = []) {
    this.events = events
    this.paneView = new PeakOverlayPaneView(this)
    this.views = [this.paneView]
  }

  setEvents(events: readonly PeakOverlayEvent[]): void {
    this.events = events
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
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

  paneViews(): readonly PeakOverlayPaneView[] {
    return this.views
  }
}
