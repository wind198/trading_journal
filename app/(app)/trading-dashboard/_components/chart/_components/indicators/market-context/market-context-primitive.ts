import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import type { KeyLevelZone, RegimeSegment } from '../../../../../_lib/overlays/baseline-indicators'

type Rect = { x1: number; x2: number; y1: number; y2: number; fill: string }
type KeyZoneBand = { x1: number | null; x2: number | null; y1: number; y2: number; fill: string }
type Line = { x1: number | null; x2: number | null; y: number; color: string }

class ContextRenderer {
  constructor(
    private readonly rects: readonly Rect[],
    private readonly bands: readonly KeyZoneBand[],
    private readonly lines: readonly Line[],
  ) {}
  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      for (const rect of this.rects) {
        const left = Math.min(rect.x1, rect.x2)
        const top = Math.min(rect.y1, rect.y2)
        const width = Math.max(1, Math.abs(rect.x2 - rect.x1))
        const height = Math.max(1, Math.abs(rect.y2 - rect.y1))
        context.fillStyle = rect.fill
        context.fillRect(left, top, width, height)
      }
      for (const band of this.bands) {
        const left = band.x1 ?? 0
        const right = band.x2 ?? mediaSize.width
        const top = Math.min(band.y1, band.y2)
        context.fillStyle = band.fill
        context.fillRect(left, top, Math.max(1, right - left), Math.max(1, Math.abs(band.y2 - band.y1)))
      }
      for (const line of this.lines) {
        context.beginPath()
        context.moveTo(line.x1 ?? 0, line.y)
        context.lineTo(line.x2 ?? mediaSize.width, line.y)
        context.strokeStyle = line.color
        context.lineWidth = 1
        context.setLineDash([])
        context.stroke()
      }
    })
  }
}

class ContextPaneView {
  private rendererObj: ContextRenderer | null = null
  constructor(private readonly source: MarketContextPrimitive) {}
  zOrder(): 'bottom' { return 'bottom' }
  renderer(): ContextRenderer | null { return this.rendererObj }
  update(): void {
    const { chart, series } = this.source
    if (!chart || !series) { this.rendererObj = null; return }
    const height = chart.panes()[0]?.getHeight() ?? 0
    const rects: Rect[] = []
    const bands: KeyZoneBand[] = []
    const lines: Line[] = []
    for (const segment of this.source.regimes) {
      const x1 = chart.timeScale().timeToCoordinate(segment.startTime as Time)
      const x2 = chart.timeScale().timeToCoordinate(segment.endTime as Time)
      if (x1 == null || x2 == null) continue
      const fill = segment.regime === 'UP'
        ? 'rgba(34, 197, 94, 0.075)'
        : segment.regime === 'DOWN'
          ? 'rgba(239, 68, 68, 0.075)'
          : 'rgba(148, 163, 184, 0.07)'
      rects.push({ x1: Number(x1), x2: Number(x2), y1: 0, y2: height, fill })
    }
    for (const zone of this.source.levels) {
      const x1 = chart.timeScale().timeToCoordinate(zone.startTime as Time)
      const x2 = chart.timeScale().timeToCoordinate(zone.endTime as Time)
      const yUpper = series.priceToCoordinate(zone.upper)
      const yLower = series.priceToCoordinate(zone.lower)
      const yCenter = series.priceToCoordinate(zone.center)
      if (yUpper == null || yLower == null || yCenter == null) continue
      const belowCurrent = this.source.currentPrice != null && zone.center < this.source.currentPrice
      bands.push({
        x1: x1 == null ? null : Number(x1),
        x2: x2 == null ? null : Number(x2),
        y1: Number(yUpper),
        y2: Number(yLower),
        fill: belowCurrent ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
      })
      lines.push({
        x1: x1 == null ? null : Number(x1),
        x2: x2 == null ? null : Number(x2),
        y: Number(yCenter),
        color: belowCurrent ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
      })
    }
    this.rendererObj = new ContextRenderer(rects, bands, lines)
  }
}

export class MarketContextPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  regimes: readonly RegimeSegment[] = []
  levels: readonly KeyLevelZone[] = []
  currentPrice: number | null = null
  private requestUpdate: (() => void) | null = null
  private readonly view = new ContextPaneView(this)
  setRegimes(regimes: readonly RegimeSegment[]): void { this.regimes = regimes; this.requestUpdate?.() }
  setLevels(levels: readonly KeyLevelZone[]): void { this.levels = levels; this.requestUpdate?.() }
  setCurrentPrice(price: number | null): void { this.currentPrice = price; this.requestUpdate?.() }
  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = param.chart; this.series = param.series; this.requestUpdate = param.requestUpdate
  }
  detached(): void { this.chart = null; this.series = null; this.requestUpdate = null }
  updateAllViews(): void { this.view.update() }
  paneViews(): readonly ContextPaneView[] { return [this.view] }
}
