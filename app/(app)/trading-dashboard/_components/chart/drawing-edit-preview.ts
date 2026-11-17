import type { DrawingPoint } from '../../_lib/chart/chart-drawings'
import type { ChartHandle } from './price-chart-handle'

type TwoPointPending = { kind: 'two-point'; id: string; p1: DrawingPoint; p2: DrawingPoint }
type PolylinePending = { kind: 'polyline'; id: string; points: DrawingPoint[] }
type Pending = TwoPointPending | PolylinePending

/** Imperatively patch a live two-point drawing on the chart handle (no React). */
export function patchTwoPointDrawing(
  handle: ChartHandle,
  id: string,
  p1: DrawingPoint,
  p2: DrawingPoint,
): boolean {
  if (handle.trendlines.getDrawing(id)) {
    handle.trendlines.setLines(
      handle.trendlines.lines.map((item) => (item.id === id ? { ...item, p1, p2 } : item)),
    )
    return true
  }
  if (handle.rectangles.getDrawing(id)) {
    handle.rectangles.setRects(
      handle.rectangles.rects.map((item) => (item.id === id ? { ...item, p1, p2 } : item)),
    )
    return true
  }
  if (handle.fibonacciRanges.getDrawing(id)) {
    handle.fibonacciRanges.setRanges(
      handle.fibonacciRanges.ranges.map((item) => (item.id === id ? { ...item, p1, p2 } : item)),
    )
    return true
  }
  if (handle.warningCircles.getDrawing(id)) {
    handle.warningCircles.setCircles(
      handle.warningCircles.circles.map((item) => (item.id === id ? { ...item, p1, p2 } : item)),
    )
    return true
  }
  if (handle.icons.getDrawing(id)) {
    handle.icons.setIcons(
      handle.icons.icons.map((item) => (item.id === id ? { ...item, p1 } : item)),
    )
    return true
  }
  if (handle.textAnchors.getDrawing(id)) {
    handle.textAnchors.setAnchors(
      handle.textAnchors.anchors.map((item) => (item.id === id ? { ...item, p1 } : item)),
    )
    return true
  }
  return false
}

/** Imperatively patch polyline or fib extension (3-point) during edit drag. */
export function patchPolylineDrawing(
  handle: ChartHandle,
  id: string,
  points: DrawingPoint[],
): boolean {
  if (handle.polylines.getDrawing(id)) {
    handle.polylines.setPolylines(
      handle.polylines.polylines.map((item) => (item.id === id ? { ...item, points } : item)),
    )
    return true
  }
  if (handle.fibonacciExtensions.getDrawing(id) && points.length >= 3) {
    handle.fibonacciExtensions.setExtensions(
      handle.fibonacciExtensions.ranges.map((item) =>
        item.id === id
          ? { id, points: [points[0]!, points[1]!, points[2]!] as [DrawingPoint, DrawingPoint, DrawingPoint] }
          : {
              id: item.id,
              points: [item.p1, item.p2, item.p3!] as [DrawingPoint, DrawingPoint, DrawingPoint],
            },
      ),
    )
    return true
  }
  return false
}

/**
 * Coalesces edit drag previews to one imperative handle patch per frame
 * (same rAF pattern as create drafts — avoids per-move React setState).
 */
export class DrawingEditPreviewScheduler {
  private frame: number | null = null
  private pending: Pending | null = null

  constructor(
    private readonly handle: ChartHandle,
    private readonly restore: () => void,
  ) {}

  scheduleTwoPoint(id: string, p1: DrawingPoint, p2: DrawingPoint): void {
    this.pending = { kind: 'two-point', id, p1, p2 }
    this.ensureFrame()
  }

  schedulePolyline(id: string, points: DrawingPoint[]): void {
    this.pending = { kind: 'polyline', id, points }
    this.ensureFrame()
  }

  /** Apply latest pending patch immediately (e.g. before React sync on pointer-up). */
  flush(): Pending | null {
    if (this.frame != null) cancelAnimationFrame(this.frame)
    this.frame = null
    const pending = this.pending
    this.pending = null
    if (pending) this.apply(pending)
    return pending
  }

  /** Drop pending frame and restore primitives from React-owned refs. */
  discardAndRestore(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.pending = null
    this.restore()
  }

  discard(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.pending = null
  }

  private ensureFrame(): void {
    if (this.frame != null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      const pending = this.pending
      this.pending = null
      if (pending) this.apply(pending)
    })
  }

  private apply(pending: Pending): void {
    if (pending.kind === 'two-point') {
      patchTwoPointDrawing(this.handle, pending.id, pending.p1, pending.p2)
      return
    }
    patchPolylineDrawing(this.handle, pending.id, pending.points)
  }
}
