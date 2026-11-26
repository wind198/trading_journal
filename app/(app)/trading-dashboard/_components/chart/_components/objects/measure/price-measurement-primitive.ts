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
  formatPriceMeasurement,
  formatBarMeasurement,
  type PriceMeasurementState,
} from './price-measurement'

const EDGE_MARGIN = 12
const TICK_HALF_WIDTH = 7
const LABEL_PADDING_X = 6
const LABEL_HEIGHT = 22
const STROKE = '#F0AD4E'
const LABEL_BACKGROUND = 'rgba(17, 24, 39, 0.88)'

export type PriceMeasurementGeometry = {
  x: number
  endX:number
  barLabel:string|null
  startY: number
  endY: number
  top: number
  bottom: number
  labelY: number
  label: string
}

export function buildPriceMeasurementGeometry(
  state: PriceMeasurementState,
  priceToY: (price: number) => number | null,
  width: number,
  height: number,
): PriceMeasurementGeometry | null {
  if (state.status !== 'placing' && state.status !== 'complete') return null
  const startY = priceToY(state.start.price)
  const endY = priceToY(state.end.price)
  const label = formatPriceMeasurement(state.start.price, state.end.price)
  if (startY == null || endY == null || !label || width <= 0 || height <= 0) return null
  const x = Math.min(Math.max(state.start.x, EDGE_MARGIN), Math.max(EDGE_MARGIN, width - EDGE_MARGIN))
  const top = Math.min(startY, endY)
  const bottom = Math.max(startY, endY)
  return {
    x,
    endX:Math.min(Math.max(state.end.x,EDGE_MARGIN),Math.max(EDGE_MARGIN,width-EDGE_MARGIN)),
    barLabel:formatBarMeasurement(state.start,state.end),
    startY,
    endY,
    top,
    bottom,
    labelY: Math.min(Math.max((top + bottom) / 2, LABEL_HEIGHT / 2), height - LABEL_HEIGHT / 2),
    label,
  }
}

class PriceMeasurementRenderer {
  private readonly geometry: PriceMeasurementGeometry | null
  private readonly placing: boolean

  constructor(geometry: PriceMeasurementGeometry | null, placing: boolean) {
    this.geometry = geometry
    this.placing = placing
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (!this.geometry) return
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const g = this.geometry
      if (!g) return
      context.save()
      context.strokeStyle = STROKE
      context.fillStyle = STROKE
      context.lineWidth = 1.5
      context.setLineDash(this.placing ? [5, 4] : [])
      context.beginPath()
      context.moveTo(g.x, g.startY)
      context.lineTo(g.x, g.endY)
      context.moveTo(g.x - TICK_HALF_WIDTH, g.startY)
      context.lineTo(g.x + TICK_HALF_WIDTH, g.startY)
      context.moveTo(g.x - TICK_HALF_WIDTH, g.endY)
      context.lineTo(g.x + TICK_HALF_WIDTH, g.endY)
      context.moveTo(g.x,g.endY)
      context.lineTo(g.endX,g.endY)
      context.moveTo(g.endX,g.endY-TICK_HALF_WIDTH)
      context.lineTo(g.endX,g.endY+TICK_HALF_WIDTH)
      context.stroke()

      context.setLineDash([])
      context.font = '12px system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const textWidth = context.measureText(g.label).width
      const boxWidth = textWidth + LABEL_PADDING_X * 2
      const boxX = Math.min(
        Math.max(g.x + TICK_HALF_WIDTH + 4, 2),
        Math.max(2, mediaSize.width - boxWidth - 2),
      )
      const boxY = g.labelY - LABEL_HEIGHT / 2
      context.fillStyle = LABEL_BACKGROUND
      context.fillRect(boxX, boxY, boxWidth, LABEL_HEIGHT)
      context.fillStyle = '#fff'
      context.textAlign = 'left'
      context.fillText(g.label, boxX + LABEL_PADDING_X, g.labelY)
      if(g.barLabel){
        const bw=context.measureText(g.barLabel).width+12
        const bx=Math.max(2,Math.min((g.x+g.endX-bw)/2,mediaSize.width-bw-2))
        const by=Math.max(2,Math.min(g.endY+10,mediaSize.height-LABEL_HEIGHT-2))
        context.fillStyle=LABEL_BACKGROUND;context.fillRect(bx,by,bw,LABEL_HEIGHT)
        context.fillStyle='#fff';context.fillText(g.barLabel,bx+6,by+LABEL_HEIGHT/2)
      }
      context.restore()
    })
  }
}

class PriceMeasurementPaneView {
  private rendererObject = new PriceMeasurementRenderer(null, false)
  private readonly source: PriceMeasurementPrimitive

  constructor(source: PriceMeasurementPrimitive) {
    this.source = source
  }

  zOrder(): 'top' {
    return 'top'
  }

  update(): void {
    const { chart, series, state } = this.source
    if (!chart || !series) {
      this.rendererObject = new PriceMeasurementRenderer(null, false)
      return
    }
    const element = chart.chartElement()
    const geometry = buildPriceMeasurementGeometry(
      state,
      (price) => {
        const coordinate = series.priceToCoordinate(price)
        return coordinate == null ? null : Number(coordinate)
      },
      element.clientWidth,
      element.clientHeight,
    )
    this.rendererObject = new PriceMeasurementRenderer(geometry, state.status === 'placing')
  }

  renderer(): PriceMeasurementRenderer {
    return this.rendererObject
  }
}

export class PriceMeasurementPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  state: PriceMeasurementState = { status: 'idle' }
  private requestUpdate: (() => void) | null = null
  private readonly view = new PriceMeasurementPaneView(this)
  private readonly views = [this.view]

  setState(state: PriceMeasurementState): void {
    this.state = state
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
    this.state = { status: 'idle' }
  }

  updateAllViews(): void {
    this.view.update()
  }

  paneViews(): readonly PriceMeasurementPaneView[] {
    return this.views
  }
}
