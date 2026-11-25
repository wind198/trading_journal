import type { ChartHandle } from '../../price-chart-handle'

type ScreenPoint = { x: number; y: number }

export type DrawingSelectionPorts = {
  handle: ChartHandle
  syncHitGeometry: () => void
  select: (id: string | null) => void
  editLabel: (id: string) => void
}

/** Resolves drawing selection and label edit gestures without owning DOM listeners. */
export class DrawingSelectionSession {
  private lastLabelTap: { id: string; time: number; x: number; y: number } | null = null
  private tapStart: { x: number; y: number; pointerId: number } | null = null
  private didDrag = false
  private skipNextClick = false

  constructor(
    private readonly ports: DrawingSelectionPorts,
    private readonly doubleTapMs: number,
    private readonly doubleTapPx: number,
    private readonly tapThresholdPx = 12,
  ) {}

  get activePointerId(): number | null { return this.tapStart?.pointerId ?? null }

  pointerDown(event: PointerEvent): void {
    this.tapStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }

  pointerUp(event: PointerEvent): boolean {
    const tap = this.tapStart
    this.tapStart = null
    if (!tap || tap.pointerId !== event.pointerId) return false
    if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > this.tapThresholdPx) return false
    this.skipNextClick = true
    return true
  }

  cancelPointer(): void { this.tapStart = null }
  markDrag(): void { this.didDrag = true }
  suppressNextClick(): void { this.skipNextClick = true }

  shouldIgnoreChartClick(): boolean {
    if (this.skipNextClick) {
      this.skipNextClick = false
      this.didDrag = false
      return true
    }
    if (this.didDrag) {
      this.didDrag = false
      return true
    }
    return false
  }

  resetPointer(): void {
    this.tapStart = null
    this.didDrag = false
  }

  reset(): void {
    this.lastLabelTap = null
  }

  dispose(): void {
    this.reset()
    this.resetPointer()
    this.skipNextClick = false
  }

  private tryOpenLabelEditor(clientX: number, clientY: number, id: string): boolean {
    const prev = this.lastLabelTap
    const now = Date.now()
    if (prev && prev.id === id && now - prev.time <= this.doubleTapMs &&
        Math.hypot(clientX - prev.x, clientY - prev.y) <= this.doubleTapPx) {
      this.lastLabelTap = null
      this.ports.editLabel(id)
      return true
    }
    this.lastLabelTap = { id, time: now, x: clientX, y: clientY }
    return false
  }

  tap(point: ScreenPoint, clientX?: number, clientY?: number): void {
    this.ports.syncHitGeometry()
    const { handle } = this.ports
    const lineHit = handle.trendlines.hitTest(point.x, point.y)
    const rectHit = handle.rectangles.hitTest(point.x, point.y)
    const fibHit = handle.fibonacciRanges.hitTest(point.x, point.y)
    const extensionHit = handle.fibonacciExtensions.hitTest(point.x, point.y)
    const circleHit = handle.warningCircles.hitTest(point.x, point.y)
    const iconHit = handle.icons.hitTest(point.x, point.y)
    const polyHit = handle.polylines.hitTest(point.x, point.y)
    const textHit = handle.textAnchors.hitTest(point.x, point.y)
    const channelHit=handle.parallelChannels?.hitTest(point.x,point.y)
    const hit = [channelHit,lineHit, fibHit, extensionHit, rectHit, circleHit, iconHit, polyHit, textHit]
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0]
    const hitId = hit?.externalId ?? null
    if (hitId &&
        (polyHit?.externalId === hitId || textHit?.externalId === hitId || circleHit?.externalId === hitId) &&
        clientX != null && clientY != null && this.tryOpenLabelEditor(clientX, clientY, hitId)) {
      this.ports.select(hitId)
      return
    }
    this.ports.select(hitId)
  }

  /** Returns true when a label editor was opened. */
  doubleClick(point: ScreenPoint): boolean {
    this.ports.syncHitGeometry()
    const { handle } = this.ports
    const polyHit = handle.polylines.hitTest(point.x, point.y)
    const textHit = handle.textAnchors.hitTest(point.x, point.y)
    const circleHit = handle.warningCircles.hitTest(point.x, point.y)
    const id = polyHit?.externalId ?? textHit?.externalId ?? circleHit?.externalId
    if (!id) return false
    this.ports.select(id)
    this.ports.editLabel(id)
    return true
  }
}
