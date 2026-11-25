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
import { chartXAtTime, type BarTimeSeries } from '../../../../../_lib/chart/chart-coordinates'
import { sessionVerticalLines, chartZoneYmdFromDate, defaultSessionOpenTimes, type SessionOpenTimes, type SessionVerticalLine } from '../../../../../_lib/chart/chart-timezone'

const DASH = [4, 4] as const

class SessionVerticalLinesRenderer implements IPrimitivePaneRenderer {
  constructor(private lines: (SessionVerticalLine & { x: number })[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const h = mediaSize.height
      context.save()
      context.lineWidth = 1
      context.setLineDash(DASH)
      context.font = '10px system-ui, sans-serif'
      context.textBaseline = 'top'
      for (const {x,color,label} of this.lines) {
        if (x < 0 || x > mediaSize.width) continue
        context.strokeStyle = color
        context.fillStyle = color
        context.beginPath()
        context.moveTo(x, 0)
        context.lineTo(x, h)
        context.stroke()
        context.fillText(label, x+3, 3)
      }
      context.restore()
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
    const xs: (SessionVerticalLine & {x:number})[] = []
    const bars = this.source.bars
    for (const line of this.source.lines()) {
      const x = chartXAtTime(chart, line.time, bars)
      if (x != null) xs.push({...line,x:Number(x)})
    }
    this.rendererObj = xs.length > 0 ? new SessionVerticalLinesRenderer(xs) : null
  }
}

export class SessionVerticalLinesPrimitive implements IPanePrimitive<Time> {
  chart: IChartApi | null = null
  bars: BarTimeSeries = []
  /** null = all slots enabled. */
  enabledSlots: ReadonlySet<string> | null = null
  openTimes: SessionOpenTimes = defaultSessionOpenTimes()
  private cachedLines: SessionVerticalLine[] = []
  private cachedDay = ''
  lines(): SessionVerticalLine[] {
    // Recompute on settings change or day rollover, not on every pan/zoom frame.
    const {year,month,day:date} = chartZoneYmdFromDate(new Date())
    const day = `${year}-${month}-${date}`
    if (this.cachedDay !== day) { this.cachedLines = sessionVerticalLines(this.enabledSlots,this.openTimes); this.cachedDay = day }
    return this.cachedLines
  }
  setOpenTimes(times: SessionOpenTimes): void { this.openTimes = times; this.cachedDay = ''; this.requestUpdate?.() }
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

  setEnabledSlots(enabled: ReadonlySet<string> | null): void {
    this.enabledSlots = enabled
    this.cachedDay = ''
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
