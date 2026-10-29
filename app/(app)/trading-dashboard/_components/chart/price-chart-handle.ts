import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import { timeAtChartX, type BarTimeSeries } from '../../_lib/chart/chart-coordinates'
import {
  formatChartCrosshairTime,
  formatChartTickMark,
} from '../../_lib/chart/chart-timezone'
import type { DrawingPoint } from '../../_lib/chart/chart-drawings'
import {
  BOLLINGER,
  CANDLE,
  CHART_THEME,
  PRICE_FORMAT,
  VIEWPORT,
} from '../../_lib/chart/price-chart-style'
import type { ChartType } from '../../_lib/chart/price-chart-series'
import { EngulfingOverlayPrimitive } from './primitives/engulfing-overlay-primitive'
import { ForceOverlayPrimitive } from './primitives/force-overlay-primitive'
import { IconMarkerPrimitive } from './primitives/icon-marker-primitive'
import { RectanglePrimitive } from './primitives/rectangle-primitive'
import { PolylineArrowPrimitive } from './primitives/polyline-arrow-primitive'
import { SessionVerticalLinesPrimitive } from './primitives/session-vertical-lines-primitive'
import { TrendlinePrimitive } from './primitives/trendline-primitive'
import { VolumeProfilePrimitive } from './primitives/volume-profile-primitive'

type LwcModule = typeof import('lightweight-charts')

type AnyPrimitive =
  | TrendlinePrimitive
  | RectanglePrimitive
  | IconMarkerPrimitive
  | PolylineArrowPrimitive
  | ForceOverlayPrimitive
  | EngulfingOverlayPrimitive
  | VolumeProfilePrimitive

type PriceSeries = {
  setData: (data: readonly object[]) => void
  attachPrimitive: (primitive: AnyPrimitive) => void
}

type LineSeries = {
  setData: (data: { time: Time; value: number }[]) => void
}

export type ChartHandle = {
  chart: IChartApi
  price: PriceSeries & ISeriesApi<SeriesType, Time>
  upper: LineSeries
  middle: LineSeries
  lower: LineSeries
  trendlines: TrendlinePrimitive
  rectangles: RectanglePrimitive
  icons: IconMarkerPrimitive
  polylines: PolylineArrowPrimitive
  forceOverlay: ForceOverlayPrimitive
  engulfingOverlay: EngulfingOverlayPrimitive
  sessionVerticalLines: SessionVerticalLinesPrimitive | null
  volumeProfile: VolumeProfilePrimitive | null
  fitted: boolean
  firstTime: number | null
}

export function usesSessionVerticalGrid(timeframe: string): boolean {
  return timeframe === '3m' || timeframe === '15m'
}

export function usesVolumeProfile(timeframe: string): boolean {
  return timeframe === '15m'
}

export function syncDrawingBars(handle: ChartHandle, candles: BarTimeSeries) {
  handle.trendlines.setBars(candles)
  handle.rectangles.setBars(candles)
  handle.icons.setBars(candles)
  handle.polylines.setBars(candles)
}

/** Resolve click → time/price at cursor (no series or bar-center snap). */
export function clickToPoint(
  handle: ChartHandle,
  point: { x: number; y: number },
  candles: BarTimeSeries | null | undefined,
): DrawingPoint | null {
  try {
    const bars = candles ?? []
    const timeSec = timeAtChartX(handle.chart, point.x, bars)
    if (timeSec == null) return null
    const priceRaw = handle.price.coordinateToPrice(point.y)
    if (priceRaw == null) return null
    return { time: timeSec, price: Number(priceRaw) }
  } catch {
    return null
  }
}

export function initPriceChart(
  lwc: LwcModule,
  el: HTMLElement,
  options: {
    chartType: ChartType
    timeframe: string
    axesVisible: boolean
    onLoadOlder: () => void
  },
): { handle: ChartHandle; chartEl: HTMLElement } {
  const sessionGrid = usesSessionVerticalGrid(options.timeframe)

  const created = lwc.createChart(el, {
    autoSize: true,
    layout: {
      background: { type: lwc.ColorType.Solid, color: 'transparent' },
      textColor: CHART_THEME.text,
    },
    grid: {
      vertLines: { color: CHART_THEME.grid, visible: !sessionGrid },
      horzLines: { color: CHART_THEME.grid },
    },
    localization: {
      timeFormatter: (time: Time) => formatChartCrosshairTime(time),
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      visible: options.axesVisible,
      tickMarkFormatter: (time: Time, tickMarkType: number) =>
        formatChartTickMark(time, tickMarkType),
    },
    rightPriceScale: { borderVisible: false, visible: options.axesVisible },
  })

  const { chartType } = options
  const price =
    chartType === 'candlestick'
      ? created.addSeries(lwc.CandlestickSeries, {
          priceFormat: PRICE_FORMAT,
          upColor: CANDLE.up,
          downColor: CANDLE.down,
          borderUpColor: CANDLE.borderUp,
          borderDownColor: CANDLE.borderDown,
          wickUpColor: CANDLE.wickUp,
          wickDownColor: CANDLE.wickDown,
        })
      : chartType === 'bar'
        ? created.addSeries(lwc.BarSeries, {
            priceFormat: PRICE_FORMAT,
            upColor: CANDLE.up,
            downColor: CANDLE.down,
          })
        : chartType === 'area'
          ? created.addSeries(lwc.AreaSeries, {
              priceFormat: PRICE_FORMAT,
              lineColor: CHART_THEME.priceLine,
              topColor: CHART_THEME.areaTop,
              bottomColor: CHART_THEME.areaBottom,
            })
          : created.addSeries(lwc.LineSeries, {
              priceFormat: PRICE_FORMAT,
              color: CHART_THEME.priceLine,
              lineWidth: 2,
            })

  const line = (color: string) =>
    created.addSeries(lwc.LineSeries, {
      color,
      lineWidth: 1,
      priceFormat: PRICE_FORMAT,
      priceLineVisible: false,
      lastValueVisible: false,
    })

  const trendlinePrimitive = new TrendlinePrimitive([])
  const rectanglePrimitive = new RectanglePrimitive([])
  const iconMarkerPrimitive = new IconMarkerPrimitive([])
  const polylineArrowPrimitive = new PolylineArrowPrimitive([])
  const forceOverlayPrimitive = new ForceOverlayPrimitive([])
  const engulfingOverlayPrimitive = new EngulfingOverlayPrimitive([])
  price.attachPrimitive(trendlinePrimitive)
  price.attachPrimitive(rectanglePrimitive)
  price.attachPrimitive(iconMarkerPrimitive)
  price.attachPrimitive(polylineArrowPrimitive)
  price.attachPrimitive(forceOverlayPrimitive)
  price.attachPrimitive(engulfingOverlayPrimitive)

  const volumeProfilePrimitive = usesVolumeProfile(options.timeframe)
    ? new VolumeProfilePrimitive()
    : null
  if (volumeProfilePrimitive) price.attachPrimitive(volumeProfilePrimitive)

  const sessionVerticalLinesPrimitive = sessionGrid
    ? new SessionVerticalLinesPrimitive()
    : null
  if (sessionVerticalLinesPrimitive) {
    created.panes()[0].attachPrimitive(sessionVerticalLinesPrimitive)
  }

  let adjusting = false
  created.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!range || adjusting) return
    if (range.to - range.from > VIEWPORT.maxVisibleBars) {
      adjusting = true
      created.timeScale().setVisibleLogicalRange({
        from: range.to - VIEWPORT.maxVisibleBars,
        to: range.to,
      })
      adjusting = false
      return
    }
    if (range.from < VIEWPORT.loadEdge) options.onLoadOlder()
  })

  const handle: ChartHandle = {
    chart: created,
    price: price as unknown as PriceSeries & ISeriesApi<SeriesType, Time>,
    upper: line(BOLLINGER.bandUpper) as LineSeries,
    middle: line(BOLLINGER.bandMiddle) as LineSeries,
    lower: line(BOLLINGER.bandLower) as LineSeries,
    trendlines: trendlinePrimitive,
    rectangles: rectanglePrimitive,
    icons: iconMarkerPrimitive,
    polylines: polylineArrowPrimitive,
    forceOverlay: forceOverlayPrimitive,
    engulfingOverlay: engulfingOverlayPrimitive,
    sessionVerticalLines: sessionVerticalLinesPrimitive,
    volumeProfile: volumeProfilePrimitive,
    fitted: false,
    firstTime: null,
  }

  const chartEl = created.chartElement()
  chartEl.style.touchAction = 'manipulation'

  return { handle, chartEl }
}
