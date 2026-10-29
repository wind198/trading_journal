import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  IPanePrimitive,
  IPanePrimitivePaneView,
  IPrimitivePaneRenderer,
  LogicalRangeChangeEventHandler,
  PaneAttachedParameter,
  Time,
} from 'lightweight-charts'
import { chartXAtTime, type BarTimeSeries } from '../../../_lib/chart/chart-coordinates'
import { sessionVerticalLineTimes } from '../../../_lib/chart/chart-timezone'
import { SESSION_GRID } from '../../../_lib/chart/price-chart-style'

const DASH = [4, 4] as const

class SessionVerticalLinesRenderer implements IPrimitivePaneRenderer {
  constructor(private xs: number[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const h = mediaSize.height
      context.strokeStyle = SESSION_GRID.line
      context.lineWidth = 1
      context.setLineDash(DASH)
      for (const x of this.xs) {
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, h)
        context.stroke()
      }
      context.setLineDash([])
    })
  }
}

class SessionVerticalLinesPaneView implements IPanePrimitivePaneView {
  private rendererObj: SessionVerticalLinesRenderer | null = null

  constructor(private source: SessionVerticalLinesPrimitive) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  renderer(): SessionVerticalLinesRenderer | null {
    return this.rendererObj
  }

  update(): void {
    const chart = this.source.chart
    if (!chart) {
      this.rendererObj = null
      return
    }
    const xs: number[] = []
    const bars = this.source.bars
    for (const unix of sessionVerticalLineTimes()) {
      const x = chartXAtTime(chart, unix, bars)
      if (x != null) xs.push(Number(x))
    }
    this.rendererObj = xs.length > 0 ? new SessionVerticalLinesRenderer(xs) : null
  }
}

export class SessionVerticalLinesPrimitive implements IPanePrimitive<Time> {
  chart: IChartApi | null = null
  bars: BarTimeSeries = []
  private requestUpdate: (() => void) | null = null
  private readonly paneView: SessionVerticalLinesPaneView
  private readonly views: SessionVerticalLinesPaneView[]
  private onVisibleRangeChange: LogicalRangeChangeEventHandler | null = null

  constructor() {
    this.paneView = new SessionVerticalLinesPaneView(this)
    this.views = [this.paneView]
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
    this.requestUpdate?.()
  }

  attached(param: PaneAttachedParameter<Time>): void {
    this.chart = param.chart as IChartApi
    this.requestUpdate = param.requestUpdate
    this.onVisibleRangeChange = () => {
      this.requestUpdate?.()
    }
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.onVisibleRangeChange)
    this.paneView.update()
  }

  detached(): void {
    if (this.chart && this.onVisibleRangeChange) {
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.onVisibleRangeChange)
    }
    this.chart = null
    this.requestUpdate = null
    this.onVisibleRangeChange = null
  }

  updateAllViews(): void {
    this.paneView.update()
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views
  }
}
