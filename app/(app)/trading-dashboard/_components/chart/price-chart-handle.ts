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
  ICHIMOKU,
  PRICE_FORMAT,
  VIEWPORT,
} from '../../_lib/chart/price-chart-style'
import { DEFAULT_PRICE_SCALE_MARGIN } from '../../_lib/chart/chart-default-layout'
import { IchimokuCloudPrimitive } from './_components/indicators/ichimoku/ichimoku-cloud-primitive'
import type { ChartType } from '../../_lib/chart/price-chart-series'
import { IndicatorLayer } from './_components/indicators/indicator-layer'
import { IconMarkerPrimitive } from './_components/objects/icon/icon-marker-primitive'
import { RectanglePrimitive } from './_components/objects/rect/rectangle-primitive'
import { FibonacciRangeExtensionPrimitive } from './_components/objects/fibonacci-extension/fibonacci-range-extension-primitive'
import { FibonacciRangePrimitive } from './_components/objects/fibonacci-range/fibonacci-range-primitive'
import { PolylineArrowPrimitive } from './_components/objects/polyline/polyline-arrow-primitive'
import { TextAnchorPrimitive } from './_components/objects/text/text-anchor-primitive'
import { TrendlinePrimitive } from './_components/objects/trendline/trendline-primitive'
import { WarningCirclePrimitive } from './_components/objects/warning-circle/warning-circle-primitive'
import { PriceMeasurementPrimitive } from './_components/objects/measure/price-measurement-primitive'
import { asPrimitiveLayer, ChartPrimitiveRegistry } from './chart-primitive-registry'

type LwcModule = typeof import('lightweight-charts')

type AnyPrimitive =
  | TrendlinePrimitive
  | RectanglePrimitive
  | FibonacciRangePrimitive
  | IconMarkerPrimitive
  | PolylineArrowPrimitive
  | TextAnchorPrimitive
  | WarningCirclePrimitive
  | PriceMeasurementPrimitive

type PriceSeries = {
  setData: (data: readonly object[]) => void
  update: (bar: object, historicalUpdate?: boolean) => void
  attachPrimitive: (primitive: AnyPrimitive) => void
}

type LineSeries = {
  setData: (data: { time: Time; value: number }[]) => void
  update: (bar: { time: Time; value: number }, historicalUpdate?: boolean) => void
  applyOptions: (options: { visible?: boolean }) => void
}

export type ChartHandle = {
  chart: IChartApi
  price: PriceSeries & ISeriesApi<SeriesType, Time>
  upper: LineSeries
  middle: LineSeries
  lower: LineSeries
  ichimokuConversion: LineSeries
  ichimokuBase: LineSeries
  ichimokuCloud: IchimokuCloudPrimitive
  trendlines: TrendlinePrimitive
  rectangles: RectanglePrimitive
  fibonacciExtensions: FibonacciRangeExtensionPrimitive
  fibonacciRanges: FibonacciRangePrimitive
  icons: IconMarkerPrimitive
  polylines: PolylineArrowPrimitive
  textAnchors: TextAnchorPrimitive
  warningCircles: WarningCirclePrimitive
  measurement: PriceMeasurementPrimitive
  primitives: ChartPrimitiveRegistry
  indicators: IndicatorLayer
  fitted: boolean
  firstTime: number | null
}

export function usesSessionVerticalGrid(timeframe: string): boolean {
  return timeframe === '3m' || timeframe === '15m'
}

export function usesVolumeProfile(timeframe: string): boolean {
  return timeframe === '15m' || timeframe === '3m'
}

export function syncDrawingBars(handle: ChartHandle, candles: BarTimeSeries) {
  handle.trendlines.setBars(candles)
  handle.rectangles.setBars(candles)
  handle.fibonacciRanges.setBars(candles)
  handle.fibonacciExtensions.setBars(candles)
  handle.icons.setBars(candles)
  handle.polylines.setBars(candles)
  handle.textAnchors.setBars(candles)
  handle.warningCircles.setBars(candles)
  handle.indicators.setBars(candles)
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

/** Mid of the visible chart pane — used to seed touch shape points. */
export function viewportCenterPoint(
  handle: ChartHandle,
  candles: BarTimeSeries | null | undefined,
): DrawingPoint | null {
  try {
    const el = handle.chart.chartElement()
    return clickToPoint(
      handle,
      { x: el.clientWidth / 2, y: el.clientHeight / 2 },
      candles,
    )
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
      vertLines: { visible: false },
      horzLines: { visible: false },
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
    rightPriceScale: {
      autoScale: true,
      borderVisible: false,
      visible: options.axesVisible,
      scaleMargins: {
        top: DEFAULT_PRICE_SCALE_MARGIN,
        bottom: DEFAULT_PRICE_SCALE_MARGIN,
      },
    },
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
      /** Bands / Ichimoku must not expand the price scale when toggled or updated. */
      autoscaleInfoProvider: () => null,
    })

  const trendlinePrimitive = new TrendlinePrimitive([])
  const rectanglePrimitive = new RectanglePrimitive([])
  const fibonacciExtensionPrimitive = new FibonacciRangeExtensionPrimitive()
  const fibonacciRangePrimitive = new FibonacciRangePrimitive([])
  const iconMarkerPrimitive = new IconMarkerPrimitive([])
  const polylineArrowPrimitive = new PolylineArrowPrimitive([])
  const textAnchorPrimitive = new TextAnchorPrimitive([])
  const warningCirclePrimitive = new WarningCirclePrimitive([])
  const measurementPrimitive = new PriceMeasurementPrimitive()
  price.attachPrimitive(trendlinePrimitive)
  price.attachPrimitive(rectanglePrimitive)
  price.attachPrimitive(fibonacciRangePrimitive)
  price.attachPrimitive(fibonacciExtensionPrimitive)
  price.attachPrimitive(warningCirclePrimitive)
  price.attachPrimitive(iconMarkerPrimitive)
  price.attachPrimitive(polylineArrowPrimitive)
  price.attachPrimitive(textAnchorPrimitive)
  price.attachPrimitive(measurementPrimitive)
  const ichimokuCloudPrimitive = new IchimokuCloudPrimitive()
  price.attachPrimitive(ichimokuCloudPrimitive)
  const indicators = new IndicatorLayer(
    created,
    price as unknown as ISeriesApi<SeriesType, Time>,
    {
      volumeProfile: usesVolumeProfile(options.timeframe),
      sessionGrid,
    },
  )

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

  const primitives = new ChartPrimitiveRegistry()
  primitives.register('trendline', asPrimitiveLayer(trendlinePrimitive))
  primitives.register('rectangle', asPrimitiveLayer(rectanglePrimitive))
  primitives.register('fibonacci_range', asPrimitiveLayer(fibonacciRangePrimitive))
  primitives.register('fibonacci_range_extension', asPrimitiveLayer(fibonacciExtensionPrimitive))
  primitives.register('warning_circle', asPrimitiveLayer(warningCirclePrimitive))
  primitives.register('icon', asPrimitiveLayer(iconMarkerPrimitive))
  primitives.register('polyline', asPrimitiveLayer(polylineArrowPrimitive))
  primitives.register('text_anchor', asPrimitiveLayer(textAnchorPrimitive))

  const handle: ChartHandle = {
    chart: created,
    price: price as unknown as PriceSeries & ISeriesApi<SeriesType, Time>,
    upper: line(BOLLINGER.bandUpper) as LineSeries,
    middle: line(BOLLINGER.bandMiddle) as LineSeries,
    lower: line(BOLLINGER.bandLower) as LineSeries,
    ichimokuConversion: line(ICHIMOKU.conversion) as LineSeries,
    ichimokuBase: line(ICHIMOKU.base) as LineSeries,
    ichimokuCloud: ichimokuCloudPrimitive,
    trendlines: trendlinePrimitive,
    rectangles: rectanglePrimitive,
    fibonacciRanges: fibonacciRangePrimitive,
    fibonacciExtensions: fibonacciExtensionPrimitive,
    icons: iconMarkerPrimitive,
    polylines: polylineArrowPrimitive,
    textAnchors: textAnchorPrimitive,
    warningCircles: warningCirclePrimitive,
    measurement: measurementPrimitive,
    primitives,
    indicators,
    fitted: false,
    firstTime: null,
  }

  const chartEl = created.chartElement()
  chartEl.style.touchAction = 'manipulation'

  return { handle, chartEl }
}
