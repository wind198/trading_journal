import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import type { CloudPoint } from '@/lib/ticks/ichimoku'

type Coord = { x: number; a: number; b: number }
type Area = { bull: boolean; points: Coord[] }

class CloudRenderer {
  constructor(private areas: Area[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      for (const area of this.areas) {
        const pts = area.points
        if (pts.length < 2) continue
        context.beginPath()
        context.moveTo(pts[0].x, pts[0].a)
        for (let i = 1; i < pts.length; i++) context.lineTo(pts[i].x, pts[i].a)
        for (let i = pts.length - 1; i >= 0; i--) context.lineTo(pts[i].x, pts[i].b)
        context.closePath()
        context.fillStyle = area.bull ? 'rgba(38, 166, 154, 0.28)' : 'rgba(239, 83, 80, 0.28)'
        context.fill()
      }
    })
  }
}

class CloudPaneView {
  private rendererObj: CloudRenderer | null = null

  constructor(private source: IchimokuCloud) {}

  zOrder(): 'bottom' {
    return 'bottom'
  }

  renderer(): CloudRenderer | null {
    return this.rendererObj
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series) {
      this.rendererObj = null
      return
    }

    const areas: Area[] = []
    for (const point of this.source.cloud) {
      const x = chart.timeScale().timeToCoordinate(point.time as Time)
      const a = series.priceToCoordinate(point.a)
      const b = series.priceToCoordinate(point.b)
      if (x == null || a == null || b == null) continue
      const bull = point.a >= point.b
      const coord = { x, a, b }
      const last = areas[areas.length - 1]
      if (!last || last.bull !== bull) areas.push({ bull, points: [coord] })
      else last.points.push(coord)
    }
    this.rendererObj = new CloudRenderer(areas)
  }
}

/** Filled cloud between span A and span B. No span lines. */
export class IchimokuCloud implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  cloud: readonly CloudPoint[]
  private readonly paneView: CloudPaneView
  private readonly views: CloudPaneView[]

  constructor(cloud: readonly CloudPoint[]) {
    this.cloud = cloud
    this.paneView = new CloudPaneView(this)
    this.views = [this.paneView]
  }

  setCloud(cloud: readonly CloudPoint[]): void {
    this.cloud = cloud
  }

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = param.chart
    this.series = param.series
  }

  detached(): void {
    this.chart = null
    this.series = null
  }

  updateAllViews(): void {
    this.paneView.update()
  }

  paneViews(): readonly CloudPaneView[] {
    return this.views
  }
}
