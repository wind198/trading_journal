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
} from '@/lib/candle-overlay-layout'
import {
  ForceDirection,
  ForceStatus,
  type ForceEvent,
} from '@/lib/force-candle-decay'
import { FORCE } from '@/lib/price-chart-style'

export type ForceOverlayEvent = Pick<
  ForceEvent,
  'eventId' | 'time' | 'direction' | 'srcOpen' | 'srcClose' | 'srcHigh' | 'srcLow' | 'status'
>

type Marker = {
  cx: number
  cy: number
  size: number
  fill: string
}

function forceFill(direction: ForceDirection, status: ForceStatus): string | null {
  const palette = direction === ForceDirection.Bullish ? FORCE.bullish : FORCE.bearish
  switch (status) {
    case ForceStatus.FullyActive:
      return palette.fully
    case ForceStatus.PartiallyActive:
      return palette.partial
    case ForceStatus.BarelyActive:
      return palette.barely
    default:
      return null
  }
}

class ForceOverlayRenderer {
  constructor(private markers: Marker[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const marker of this.markers) {
        if (marker.size <= 0) continue
        context.beginPath()
        context.arc(marker.cx, marker.cy, marker.size / 2, 0, Math.PI * 2)
        context.fillStyle = marker.fill
        context.fill()
      }
    })
  }
}

class ForceOverlayPaneView {
  private rendererObj: ForceOverlayRenderer | null = null

  constructor(private source: ForceOverlayPrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): ForceOverlayRenderer | null {
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
      const fill = forceFill(event.direction, event.status)
      if (!fill) continue
      const x = chart.timeScale().timeToCoordinate(event.time as Time)
      const yHigh = series.priceToCoordinate(event.srcHigh)
      const yLow = series.priceToCoordinate(event.srcLow)
      if (x == null || yHigh == null || yLow == null) continue

      const bullish = event.direction === ForceDirection.Bullish
      const { cx, cy, size } = overlayMarkerGeometry(
        Number(x),
        spacing,
        CANDLE_OVERLAY_STACK.force,
        Number(yHigh),
        Number(yLow),
        bullish,
      )
      markers.push({ cx, cy, size, fill })
    }

    this.rendererObj = new ForceOverlayRenderer(markers)
  }
}

export class ForceOverlayPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  events: readonly ForceOverlayEvent[] = []
  private requestUpdate: (() => void) | null = null
  private readonly paneView: ForceOverlayPaneView
  private readonly views: ForceOverlayPaneView[]

  constructor(events: readonly ForceOverlayEvent[] = []) {
    this.events = events
    this.paneView = new ForceOverlayPaneView(this)
    this.views = [this.paneView]
  }

  setEvents(events: readonly ForceOverlayEvent[]): void {
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

  paneViews(): readonly ForceOverlayPaneView[] {
    return this.views
  }
}
