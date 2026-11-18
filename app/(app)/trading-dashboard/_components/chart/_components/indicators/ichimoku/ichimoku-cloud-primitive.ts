import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  LogicalRangeChangeEventHandler,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import type { CloudPoint } from '@/lib/ticks/ichimoku'
import { ICHIMOKU } from '../../../../../_lib/chart/price-chart-style'

type Segment = {
  x1: number
  x2: number
  ya1: number
  yb1: number
  ya2: number
  yb2: number
  bullish: boolean
}

class IchimokuCloudRenderer {
  constructor(private segments: Segment[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const seg of this.segments) {
        const fill = seg.bullish ? ICHIMOKU.cloudBullish : ICHIMOKU.cloudBearish
        context.beginPath()
        context.moveTo(seg.x1, seg.ya1)
        context.lineTo(seg.x2, seg.ya2)
        context.lineTo(seg.x2, seg.yb2)
        context.lineTo(seg.x1, seg.yb1)
        context.closePath()
        context.fillStyle = fill
        context.fill()
      }
    })
  }
}

class IchimokuCloudPaneView {
  private rendererObj: IchimokuCloudRenderer | null = null

  constructor(private source: IchimokuCloudPrimitive) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  renderer(): IchimokuCloudRenderer | null {
    return this.rendererObj
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series || this.source.cloud.length < 2) {
      this.rendererObj = null
      return
    }

    const segments: Segment[] = []
    const cloud = this.source.cloud

    for (let i = 0; i < cloud.length - 1; i++) {
      const p0 = cloud[i]
      const p1 = cloud[i + 1]
      const x1 = chart.timeScale().timeToCoordinate(p0.time as Time)
      const x2 = chart.timeScale().timeToCoordinate(p1.time as Time)
      const ya1 = series.priceToCoordinate(p0.a)
      const yb1 = series.priceToCoordinate(p0.b)
      const ya2 = series.priceToCoordinate(p1.a)
      const yb2 = series.priceToCoordinate(p1.b)
      if (x1 == null || x2 == null || ya1 == null || yb1 == null || ya2 == null || yb2 == null) {
        continue
      }
      const bullish = (p0.a + p1.a) / 2 >= (p0.b + p1.b) / 2
      segments.push({
        x1: Number(x1),
        x2: Number(x2),
        ya1: Number(ya1),
        yb1: Number(yb1),
        ya2: Number(ya2),
        yb2: Number(yb2),
        bullish,
      })
    }

    this.rendererObj = segments.length > 0 ? new IchimokuCloudRenderer(segments) : null
  }
}

export class IchimokuCloudPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  cloud: readonly CloudPoint[] = []
  private requestUpdate: (() => void) | null = null
  private onVisibleRangeChange: LogicalRangeChangeEventHandler | null = null
  private readonly paneView: IchimokuCloudPaneView
  private readonly views: IchimokuCloudPaneView[]

  constructor() {
    this.paneView = new IchimokuCloudPaneView(this)
    this.views = [this.paneView]
  }

  setCloud(cloud: readonly CloudPoint[]): void {
    this.cloud = cloud
    this.requestUpdate?.()
  }

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = param.chart
    this.series = param.series
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
    this.series = null
    this.requestUpdate = null
    this.onVisibleRangeChange = null
  }

  updateAllViews(): void {
    this.paneView.update()
  }

  paneViews(): readonly IchimokuCloudPaneView[] {
    return this.views
  }
}