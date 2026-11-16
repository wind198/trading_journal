import type { ChartHandle } from './price-chart-handle'

type ChartClickHandler = Parameters<ChartHandle['chart']['subscribeClick']>[0]
type CrosshairHandler = Parameters<ChartHandle['chart']['subscribeCrosshairMove']>[0]

export type PriceChartInteractionHandlers = {
  chartClick: ChartClickHandler
  crosshairMove: CrosshairHandler
  chartPointerDown: (event: PointerEvent) => void
  chartPointerMove: (event: PointerEvent) => void
  chartPointerUp: (event: PointerEvent) => void
  chartPointerCancel: (event: PointerEvent) => void
  chartDoubleClick: (event: MouseEvent) => void
  overlayPointerDown: (event: PointerEvent) => void
  overlayPointerMove: (event: PointerEvent) => void
  overlayPointerUp: (event: PointerEvent) => void
  overlayPointerCancel: (event: PointerEvent) => void
}

/** Owns chart and DOM subscriptions; event behavior is delegated to injected handlers. */
export class PriceChartInteractionMediator {
  private started = false
  private readonly pointerOpts: AddEventListenerOptions = { passive: false }

  constructor(
    private readonly chart: ChartHandle['chart'],
    private readonly chartEl: HTMLElement,
    private readonly overlayEl: HTMLElement | null,
    private readonly handlers: PriceChartInteractionHandlers,
  ) {}

  start(): void {
    if (this.started) return
    this.started = true
    const h = this.handlers
    this.chart.subscribeClick(h.chartClick)
    this.chart.subscribeCrosshairMove(h.crosshairMove)
    this.chartEl.addEventListener('pointerdown', h.chartPointerDown, this.pointerOpts)
    this.chartEl.addEventListener('pointermove', h.chartPointerMove, this.pointerOpts)
    this.chartEl.addEventListener('pointerup', h.chartPointerUp, this.pointerOpts)
    this.chartEl.addEventListener('pointercancel', h.chartPointerCancel, this.pointerOpts)
    this.chartEl.addEventListener('dblclick', h.chartDoubleClick)
    if (this.overlayEl) {
      this.overlayEl.addEventListener('pointerdown', h.overlayPointerDown, this.pointerOpts)
      this.overlayEl.addEventListener('pointermove', h.overlayPointerMove, this.pointerOpts)
      this.overlayEl.addEventListener('pointerup', h.overlayPointerUp, this.pointerOpts)
      this.overlayEl.addEventListener('pointercancel', h.overlayPointerCancel, this.pointerOpts)
    }
  }

  dispose(): void {
    if (!this.started) return
    this.started = false
    const h = this.handlers
    this.chart.unsubscribeClick(h.chartClick)
    this.chart.unsubscribeCrosshairMove(h.crosshairMove)
    this.chartEl.removeEventListener('pointerdown', h.chartPointerDown, this.pointerOpts)
    this.chartEl.removeEventListener('pointermove', h.chartPointerMove, this.pointerOpts)
    this.chartEl.removeEventListener('pointerup', h.chartPointerUp, this.pointerOpts)
    this.chartEl.removeEventListener('pointercancel', h.chartPointerCancel, this.pointerOpts)
    this.chartEl.removeEventListener('dblclick', h.chartDoubleClick)
    if (this.overlayEl) {
      this.overlayEl.removeEventListener('pointerdown', h.overlayPointerDown, this.pointerOpts)
      this.overlayEl.removeEventListener('pointermove', h.overlayPointerMove, this.pointerOpts)
      this.overlayEl.removeEventListener('pointerup', h.overlayPointerUp, this.pointerOpts)
      this.overlayEl.removeEventListener('pointercancel', h.overlayPointerCancel, this.pointerOpts)
    }
  }
}
