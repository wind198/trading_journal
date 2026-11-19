import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import type { ForceScorePoint } from '../../../../../_lib/overlays/baseline-indicators'

type ScoreBar = { x: number; width: number; height: number; color: string }

class ForceScoreRenderer {
  constructor(
    private readonly bars: readonly ScoreBar[],
    private readonly bottom: number,
    private readonly maxHeight: number,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const referenceY = this.bottom - this.maxHeight * 0.5
      context.save()
      context.beginPath()
      context.setLineDash([4, 4])
      context.strokeStyle = 'rgba(148, 163, 184, 0.7)'
      context.lineWidth = 1
      context.moveTo(0, referenceY)
      context.lineTo(mediaSize.width, referenceY)
      context.stroke()
      context.restore()

      for (const bar of this.bars) {
        context.fillStyle = bar.color
        context.fillRect(bar.x - bar.width / 2, this.bottom - bar.height, bar.width, bar.height)
      }
    })
  }
}

class ForceScorePaneView {
  private rendererObj: ForceScoreRenderer | null = null
  constructor(private readonly source: ForceScorePrimitive) {}
  zOrder(): 'top' { return 'top' }
  renderer(): ForceScoreRenderer | null { return this.rendererObj }
  update(): void {
    const chart = this.source.chart
    if (!chart || this.source.scores.length === 0) { this.rendererObj = null; return }
    const paneHeight = chart.panes()[0]?.getHeight() ?? 0
    const maxHeight = Math.min(96, paneHeight * 0.22)
    const bottom = paneHeight - 4
    const width = Math.max(1, Math.min(8, chart.timeScale().options().barSpacing * 0.65))
    const bars: ScoreBar[] = []
    for (const point of this.source.scores) {
      const x = chart.timeScale().timeToCoordinate(point.time as Time)
      if (x == null) continue
      bars.push({
        x: Number(x),
        width,
        height: maxHeight * point.score / 100,
        color: point.direction === 'BULLISH' ? 'rgba(34, 197, 94, 0.72)' : 'rgba(239, 68, 68, 0.72)',
      })
    }
    this.rendererObj = new ForceScoreRenderer(bars, bottom, maxHeight)
  }
}

export class ForceScorePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  scores: readonly ForceScorePoint[] = []
  private requestUpdate: (() => void) | null = null
  private readonly view = new ForceScorePaneView(this)
  setScores(scores: readonly ForceScorePoint[]): void { this.scores = scores; this.requestUpdate?.() }
  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }
  detached(): void { this.chart = null; this.series = null; this.requestUpdate = null }
  updateAllViews(): void { this.view.update() }
  paneViews(): readonly ForceScorePaneView[] { return [this.view] }
}
