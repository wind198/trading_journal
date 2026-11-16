import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'

type ScreenPoint = { x: number; y: number }
type Active = {
  pointerId: number
  clientX: number
  clientY: number
  origin: ScreenPoint | null
  dragged: boolean
}

/** Tracks one overlay pointer gesture and translates coarse anchor drags. */
export class CreationPointerSession {
  private active: Active | null = null
  constructor(
    private readonly mapPoint: (screen: ScreenPoint) => DrawingPoint | null,
    private readonly thresholdPx: number,
  ) {}

  get pointerId(): number | null { return this.active?.pointerId ?? null }

  begin(pointerId: number, clientX: number, clientY: number, origin: ScreenPoint | null = null): void {
    this.active = { pointerId, clientX, clientY, origin, dragged: false }
  }

  move(pointerId: number, clientX: number, clientY: number): DrawingPoint | null {
    const active = this.active
    if (!active || active.pointerId !== pointerId) return null
    const dx = clientX - active.clientX
    const dy = clientY - active.clientY
    if (Math.hypot(dx, dy) <= this.thresholdPx) return null
    active.dragged = true
    if (!active.origin) return null
    const point = this.mapPoint({ x: active.origin.x + dx, y: active.origin.y + dy })
    return point && Number.isFinite(point.time) && Number.isFinite(point.price) && point.time > 0
      ? point : null
  }

  finish(pointerId: number, clientX: number, clientY: number): { tap: boolean; dragged: boolean } | null {
    const active = this.active
    if (!active || active.pointerId !== pointerId) return null
    this.active = null
    return {
      tap: !active.dragged && Math.hypot(clientX - active.clientX, clientY - active.clientY) <= this.thresholdPx,
      dragged: active.dragged,
    }
  }

  cancel(): void { this.active = null }
  dispose(): void { this.cancel() }
}
