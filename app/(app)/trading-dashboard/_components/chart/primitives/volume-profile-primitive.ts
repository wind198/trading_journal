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

type Bar = {
  y0: number
  y1: number
  w: number
  poc: boolean
}

type Levels = {
  poc: number | null
  vah: number | null
  val: number | null
}

class VolumeProfileRenderer {
  constructor(
    private bars: Bar[],
    private levels: Levels,
    private paneWidth: number,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const width = this.paneWidth > 0 ? this.paneWidth : mediaSize.width
      for (const bar of this.bars) {
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

    const paneWidth = chart.paneSize().width
    const maxCount = frame.bins.reduce((max, bin) => Math.max(max, bin.tickCount), 0)
    if (maxCount <= 0) {
      this.rendererObj = null
      return
    }

    const maxBarW = paneWidth * VOLUME_PROFILE.maxWidthRatio
    const half = VOLUME_PROFILE_BIN_SIZE / 2
    const bars: Bar[] = []

    for (const bin of frame.bins) {
      const yMid = series.priceToCoordinate(bin.price)
      const yHi = series.priceToCoordinate(bin.price + half)
      const yLo = series.priceToCoordinate(bin.price - half)
      if (yMid == null) continue
      const y0 = yHi ?? Number(yMid) - 0.5
      const y1 = yLo ?? Number(yMid) + 0.5
      bars.push({
        y0: Number(y0),
        y1: Number(y1),
        w: (bin.tickCount / maxCount) * maxBarW,
        poc: bin.price === frame.poc,
      })
    }

    const yAt = (price: number) => {
      const y = series.priceToCoordinate(price)
      return y == null ? null : Number(y)
    }

    this.rendererObj = new VolumeProfileRenderer(
      bars,
      { poc: yAt(frame.poc), vah: yAt(frame.vah), val: yAt(frame.val) },
      paneWidth,
    )
  }
}

export class VolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType, Time> | null = null
  frame: VolumeProfileFrame | null = null
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
