import type { RefObject } from 'react'
import type { ChartHandle } from './price-chart-handle'

/** Owns chart-relative coordinates, pointer capture, and pointer-specific hit tolerance. */
export class ChartPointerAdapter {
  private rectCache: DOMRect | null = null
  private capturedPointerId: number | null = null

  constructor(
    private readonly handle: ChartHandle,
    private readonly chartEl: HTMLElement,
    private readonly captureElRef: RefObject<HTMLElement | null>,
  ) {}

  cacheRect(): void {
    this.rectCache = this.chartEl.getBoundingClientRect()
  }

  clearRect(): void {
    this.rectCache = null
  }

  localPoint(event: MouseEvent): { x: number; y: number } {
    const rect = this.rectCache ?? this.chartEl.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  capture(event: PointerEvent, el: HTMLElement): void {
    el.setPointerCapture(event.pointerId)
    this.captureElRef.current = el
    this.capturedPointerId = event.pointerId
  }

  release(event: PointerEvent): void {
    this.releaseById(event.pointerId)
  }

  releaseById(pointerId: number): void {
    const el = this.captureElRef.current ?? this.chartEl
    this.captureElRef.current = null
    this.capturedPointerId = null
    try { el.releasePointerCapture(pointerId) } catch { /* lost capture */ }
  }

  dispose(): void {
    const el = this.captureElRef.current
    const pointerId = this.capturedPointerId
    this.captureElRef.current = null
    this.capturedPointerId = null
    if (el && pointerId !== null) {
      try { el.releasePointerCapture(pointerId) } catch { /* lost capture */ }
    }
    this.rectCache = null
  }

  setHitBoost(coarse: boolean): void {
    this.handle.primitives.setHitBoost(coarse ? 1.75 : 1)
  }
}
