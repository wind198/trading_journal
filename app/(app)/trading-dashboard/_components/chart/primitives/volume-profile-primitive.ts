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
  VOLUME_PROFILE_BIN_SIZE,
  type VolumeProfileFrame,
} from '../../../_lib/chart/volume-profile'
import { VOLUME_PROFILE } from '../../../_lib/chart/price-chart-style'
import { chartXAtTime, type BarTimeSeries } from '../../../_lib/chart/chart-coordinates'

type PriceBar = {
  y0: number
  y1: number
  w: number
  poc: boolean
}

type TimeBar = {
  x: number
  w: number
  h: number
  poc: boolean
}

type Levels = {
  poc: number | null
  vah: number | null
  val: number | null
}

class VolumeProfileRenderer {
  constructor(
    private priceBars: PriceBar[],
    private timeBars: TimeBar[],
    private levels: Levels,
    private paneWidth: number,
    private paneHeight: number,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const width = this.paneWidth > 0 ? this.paneWidth : mediaSize.width
      const height = this.paneHeight > 0 ? this.paneHeight : mediaSize.height

      for (const bar of this.timeBars) {
        if (bar.w < 0.5 || bar.h < 0.5) continue
        context.fillStyle = bar.poc ? VOLUME_PROFILE.timePocBar : VOLUME_PROFILE.timeBar
        context.fillRect(bar.x, height - bar.h, bar.w, bar.h)
      }

      for (const bar of this.priceBars) {
        const top = Math.min(bar.y0, bar.y1)
        const h = Math.max(1, Math.abs(bar.y1 - bar.y0))
        context.fillStyle = bar.poc ? VOLUME_PROFILE.pocBar : VOLUME_PROFILE.bar
        context.fillRect(width - bar.w, top, bar.w, h)
      }

      const strokeLevel = (y: number | null, color: string, dash: number[]) => {
        if (y == null) return
        context.beginPath()
        context.strokeStyle = color
        context.lineWidth = 1
        context.setLineDash(dash)
        context.moveTo(0, y)
        context.lineTo(width, y)
        context.stroke()
        context.setLineDash([])
      }

      strokeLevel(this.levels.vah, VOLUME_PROFILE.va, [4, 3])
      strokeLevel(this.levels.val, VOLUME_PROFILE.va, [4, 3])
      strokeLevel(this.levels.poc, VOLUME_PROFILE.poc, [])
    })
  }
}

class VolumeProfilePaneView {
  private rendererObj: VolumeProfileRenderer | null = null

  constructor(private source: VolumeProfilePrimitive) {}

  zOrder(): 'top' {
    return 'top'
  }

  renderer(): VolumeProfileRenderer | null {
    return this.rendererObj
  }

  update(): void {
    const chart = this.source.chart
    const series = this.source.series
    const frame = this.source.frame
    if (!chart || !series || !frame || frame.bins.length === 0) {
      this.rendererObj = null
      return
    }

    const pane = chart.paneSize()
    const paneWidth = pane.width
    const paneHeight = pane.height
    const maxCount = frame.bins.reduce((max, bin) => Math.max(max, bin.tickCount), 0)
    if (maxCount <= 0) {
      this.rendererObj = null
      return
    }

    const maxBarW = paneWidth * VOLUME_PROFILE.maxWidthRatio
    const half = VOLUME_PROFILE_BIN_SIZE / 2
    const priceBars: PriceBar[] = []

    for (const bin of frame.bins) {
      const yMid = series.priceToCoordinate(bin.price)
      const yHi = series.priceToCoordinate(bin.price + half)
      const yLo = series.priceToCoordinate(bin.price - half)
      if (yMid == null) continue
      const y0 = yHi ?? Number(yMid) - 0.5
      const y1 = yLo ?? Number(yMid) + 0.5
      priceBars.push({
        y0: Number(y0),
        y1: Number(y1),
        w: (bin.tickCount / maxCount) * maxBarW,
        poc: bin.price === frame.poc,
      })
    }

    const timeBars: TimeBar[] = []
    const maxTimeCount = frame.timeBins.reduce((max, bin) => Math.max(max, bin.tickCount), 0)
    const bars = this.source.bars
    if (maxTimeCount > 0 && bars.length > 0) {
      const maxBarH = paneHeight * VOLUME_PROFILE.maxHeightRatio
      // Cap width so a bad x1 (far past/future) cannot stretch across the pane.
      const maxBarW = Math.max(8, paneWidth * 0.08)
      let timePoc = frame.timeBins[0]?.time ?? 0
      let timePocCount = -1
      for (const bin of frame.timeBins) {
        if (bin.tickCount > timePocCount) {
          timePocCount = bin.tickCount
          timePoc = bin.time
        }
      }

      const indexByTime = new Map<number, number>()
      for (let i = 0; i < bars.length; i++) {
        indexByTime.set(bars[i]!.time, i)
      }

      for (const bin of frame.timeBins) {
        const idx = indexByTime.get(bin.time)
        if (idx == null) continue
        const x0 = chartXAtTime(chart, bars[idx]!.time, bars)
        if (x0 == null || !Number.isFinite(x0)) continue

        let x1: number | null = null
        if (idx + 1 < bars.length) {
          x1 = chartXAtTime(chart, bars[idx + 1]!.time, bars)
        }
        const rawW =
          x1 != null && Number.isFinite(x1) ? Math.abs(Number(x1) - Number(x0)) : 4
        // Reject pathological spans (mis-extrapolated coords → “infinite” past bars).
        if (rawW > paneWidth * 0.25) continue
        const w = Math.max(1, Math.min(rawW, maxBarW))
        const left = Number(x0)
        if (left + w < 0 || left > paneWidth) continue

        timeBars.push({
          x: left,
          w,
          h: (bin.tickCount / maxTimeCount) * maxBarH,
          poc: bin.time === timePoc,
        })
      }
    }

    const yAt = (price: number) => {
      const y = series.priceToCoordinate(price)
      return y == null ? null : Number(y)
    }

    this.rendererObj = new VolumeProfileRenderer(
      priceBars,
      timeBars,
      { poc: yAt(frame.poc), vah: yAt(frame.vah), val: yAt(frame.val) },
      paneWidth,
      paneHeight,
    )
  }
}

export class VolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  frame: VolumeProfileFrame | null = null
  bars: BarTimeSeries = []
  private requestUpdate: (() => void) | null = null
  private readonly paneView: VolumeProfilePaneView
  private readonly views: VolumeProfilePaneView[]

  constructor() {
    this.paneView = new VolumeProfilePaneView(this)
    this.views = [this.paneView]
  }

  setProfile(frame: VolumeProfileFrame | null): void {
    this.frame = frame
    this.requestUpdate?.()
  }

  setBars(bars: BarTimeSeries): void {
    this.bars = bars
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

  updateAllViews(): void {
    this.paneView.update()
  }

  paneViews(): readonly VolumeProfilePaneView[] {
    return this.views
  }
}
