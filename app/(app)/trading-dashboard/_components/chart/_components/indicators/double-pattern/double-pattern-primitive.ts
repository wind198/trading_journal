import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type { IChartApi, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, SeriesType, Time } from 'lightweight-charts'
import type { LightweightCandle } from '@/lib/ticks/candles'
import type { DoublePattern } from '../../../../../_lib/overlays/double-pattern'

type Drawing = { points: { x: number; y: number }[]; necklineY: number; endX: number; color: string }

class DoublePatternRenderer {
  constructor(private drawings: readonly Drawing[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      context.save()
      context.globalAlpha = 0.45
      context.lineWidth = 1.5
      for (const drawing of this.drawings) {
        const [first, middle, second] = drawing.points
        if (!first || !middle || !second) continue
        context.strokeStyle = drawing.color
        context.fillStyle = drawing.color
        context.setLineDash([5, 4])
        context.beginPath()
        context.moveTo(first.x, first.y)
        context.lineTo(middle.x, middle.y)
        context.lineTo(second.x, second.y)
        context.stroke()
        context.beginPath()
        context.moveTo(middle.x, drawing.necklineY)
        context.lineTo(drawing.endX, drawing.necklineY)
        context.stroke()
        context.setLineDash([])
        for (const point of drawing.points) {
          context.beginPath()
          context.arc(point.x, point.y, 3, 0, Math.PI * 2)
          context.fill()
        }
      }
      context.restore()
    })
  }
}

class DoublePatternView {
  private rendererObj: DoublePatternRenderer | null = null
  constructor(private source: DoublePatternPrimitive) {}
  zOrder(): 'top' { return 'top' }
  renderer(): DoublePatternRenderer | null { return this.rendererObj }

  update(): void {
    const { chart, series, bars, patterns } = this.source
    if (!chart || !series) { this.rendererObj = null; return }
    const drawings: Drawing[] = []
    for (const pattern of patterns) {
      const a = bars[pattern.a]
      const m = bars[pattern.m]
      const b = bars[pattern.b]
      if (!a || !m || !b) continue
      const x1 = chart.timeScale().timeToCoordinate(a.time as Time)
      const x2 = chart.timeScale().timeToCoordinate(m.time as Time)
      const x3 = chart.timeScale().timeToCoordinate(b.time as Time)
      const y1 = series.priceToCoordinate(pattern.first)
      const y2 = series.priceToCoordinate(pattern.neckline)
      const y3 = series.priceToCoordinate(pattern.second)
      const endTime = pattern.decisionTime ?? bars.at(-1)?.time
      const endX = endTime == null ? null : chart.timeScale().timeToCoordinate(endTime as Time)
      if ([x1, x2, x3, y1, y2, y3, endX].some((value) => value == null)) continue
      drawings.push({ points: [
        { x: Number(x1), y: Number(y1) },
        { x: Number(x2), y: Number(y2) },
        { x: Number(x3), y: Number(y3) },
      ], necklineY: Number(y2), endX: Number(endX),
      color: pattern.type === 'TOP' ? '#EF4444' : '#22C55E' })
    }
    this.rendererObj = drawings.length ? new DoublePatternRenderer(drawings) : null
  }
}

export class DoublePatternPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  bars: readonly LightweightCandle[] = []
  patterns: readonly DoublePattern[] = []
  private requestUpdate: (() => void) | null = null
  private readonly view = new DoublePatternView(this)
  setData(bars: readonly LightweightCandle[], patterns: readonly DoublePattern[]): void {
    this.bars = bars
    this.patterns = patterns
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
  updateAllViews(): void { this.view.update() }
  paneViews(): readonly DoublePatternView[] { return [this.view] }
}
