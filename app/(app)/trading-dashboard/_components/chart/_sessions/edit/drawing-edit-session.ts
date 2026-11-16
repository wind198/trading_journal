import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type { BarTimeSeries } from '../../../../_lib/chart/chart-coordinates'
import { clickToPoint, type ChartHandle } from '../../price-chart-handle'
import type { EditToolSet } from './edit-tool-registry'
import type {
  NormalizedPointer,
} from '../interaction-contract'
import type {
  AnchorEditPhase,
  ScreenPoint,
  StoreAnchorBegin,
  ToolEditBehavior,
  ToolEditSession,
} from './edit-contract'

export type DrawingEditPorts = {
  handle: ChartHandle
  candles: () => BarTimeSeries
  selectedId: () => string | null
  select: (id: string) => void
  syncHitGeometry: () => void
  capture: (event: PointerEvent) => void
  release: (event: PointerEvent) => void
  releaseById: (pointerId: number) => void
  syncLock: () => void
  markDrag: () => void
  change: (id: string, p1: DrawingPoint, p2: DrawingPoint) => void
  changeEnd: (id: string) => void
  polylineChange: (id: string, points: DrawingPoint[]) => void
  polylineChangeEnd: (id: string) => void
}

export type StoreEditController = {
  begin: (request: { scopeId: string; input: unknown; pointerId: number }) => boolean
  isActive: () => boolean
  move: (pointer: NormalizedPointer) => void
  up: (pointer: NormalizedPointer) => void
  cancel: () => void
}

type ActiveLegacy = { kind: 'legacy'; session: ToolEditSession; pointerId: number }
type ActiveStore = { kind: 'store'; pointerId: number }
type ActiveEdit = ActiveLegacy | ActiveStore

/** Coordinates one active edit; geometry and hit rules live with the tool behaviors. */
export class DrawingEditSession {
  private active: ActiveEdit | null = null
  private press: { tool: ToolEditBehavior; id: string; x: number; y: number; pointerId: number } | null = null

  constructor(
    private readonly ports: DrawingEditPorts,
    private readonly tapThresholdPx: number,
    private readonly tools: EditToolSet,
    private readonly storeEdit: StoreEditController | null = null,
  ) {}

  get isDragging(): boolean {
    return this.active !== null || Boolean(this.storeEdit?.isActive())
  }

  private beginLegacy(session: ToolEditSession, event: PointerEvent): void {
    event.preventDefault()
    this.active = { kind: 'legacy', session, pointerId: event.pointerId }
    this.ports.capture(event)
    this.ports.syncLock()
  }

  private beginStore(begin: Exclude<StoreAnchorBegin, 'blocked' | null>, event: PointerEvent): boolean {
    if (!this.storeEdit) return false
    event.preventDefault()
    const started = this.storeEdit.begin({
      scopeId: begin.scopeId,
      input: begin.input,
      pointerId: event.pointerId,
    })
    if (!started) return false
    this.active = { kind: 'store', pointerId: event.pointerId }
    this.ports.capture(event)
    this.ports.syncLock()
    return true
  }

  private tryAnchorPhase(phase: AnchorEditPhase, id: string, point: ScreenPoint, event: PointerEvent): boolean {
    if (phase.kind === 'legacy') {
      const result = phase.behavior.beginAnchor?.(id, point)
      if (result === 'blocked') return true
      if (result) {
        this.beginLegacy(result, event)
        return true
      }
      return false
    }
    const result = phase.beginAnchor(id, point)
    if (result === 'blocked') return true
    if (result) return this.beginStore(result, event)
    return false
  }

  pointerDown(event: PointerEvent, point: ScreenPoint): void {
    if (this.active || this.storeEdit?.isActive()) return
    this.ports.syncHitGeometry()
    for (const tool of this.tools.press) {
      const id = tool.pressHit?.(point)
      if (!id || id.startsWith('temp-')) continue
      this.ports.select(id)
      this.press = { tool, id, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
      return
    }

    const id = this.ports.selectedId()
    if (!id || id.startsWith('temp-')) return
    const chartPoint = clickToPoint(this.ports.handle, point, this.ports.candles())
    for (const tool of this.tools.primary) {
      const session = tool.beginPrimary?.(id, point, chartPoint)
      if (session) { this.beginLegacy(session, event); return }
    }
    for (const phase of this.tools.anchors) {
      if (this.tryAnchorPhase(phase, id, point, event)) return
    }
    for (const tool of this.tools.body) {
      const session = tool.beginBody?.(id, point, chartPoint)
      if (session) { this.beginLegacy(session, event); return }
    }
  }

  pointerMove(event: PointerEvent, point: ScreenPoint): void {
    const press = this.press
    if (!this.active && !this.storeEdit?.isActive() && press && press.pointerId === event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > this.tapThresholdPx) {
      const session = press.tool.beginPress?.(press.id)
      if (session) {
        this.ports.markDrag()
        this.press = null
        this.beginLegacy(session, event)
      }
    }
    if (this.active?.pointerId !== event.pointerId) return
    const mapped = clickToPoint(this.ports.handle, point, this.ports.candles())
    if (!mapped) return
    this.ports.markDrag()
    if (this.active.kind === 'store') {
      this.storeEdit?.move({
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        coarse: event.pointerType === 'touch',
        primary: true,
        screen: point,
        chartPoint: mapped,
      })
      return
    }
    const change = this.active.session.move(mapped)
    if (change.kind === 'polyline') this.ports.polylineChange(change.id, change.points)
    else this.ports.change(change.id, change.p1, change.p2)
  }

  private finishLegacy(): boolean {
    const active = this.active
    this.active = null
    if (!active || active.kind !== 'legacy') return false
    this.ports.syncLock()
    if (active.session.changeKind === 'polyline') this.ports.polylineChangeEnd(active.session.id)
    else this.ports.changeEnd(active.session.id)
    return true
  }

  private finishStore(event: PointerEvent, point: ScreenPoint): boolean {
    const active = this.active
    this.active = null
    if (!active || active.kind !== 'store') return false
    this.storeEdit?.up({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      coarse: event.pointerType === 'touch',
      primary: true,
      screen: point,
      chartPoint: null,
    })
    this.ports.syncLock()
    return true
  }

  /** Returns true when an active edit consumed the pointer release. */
  pointerUp(event: PointerEvent): boolean {
    if (this.press?.pointerId === event.pointerId) this.press = null
    if (this.active?.pointerId !== event.pointerId) return false
    this.ports.release(event)
    if (this.active.kind === 'store') {
      return this.finishStore(event, { x: event.clientX, y: event.clientY })
    }
    return this.finishLegacy()
  }

  pointerCancel(event: PointerEvent): void {
    if (this.press?.pointerId === event.pointerId) this.press = null
    if (this.active?.pointerId !== event.pointerId) return
    this.ports.release(event)
    if (this.active.kind === 'store') {
      this.active = null
      this.storeEdit?.cancel()
      this.ports.syncLock()
      return
    }
    this.finishLegacy()
  }

  dispose(): void {
    this.cancelActive()
  }

  /** Used when the active tool changes and React releases pointer capture. */
  cancelActive(): void {
    this.press = null
    if (this.active) {
      this.ports.releaseById(this.active.pointerId)
      if (this.active.kind === 'store') {
        this.active = null
        this.storeEdit?.cancel()
        this.ports.syncLock()
        return
      }
      this.finishLegacy()
    }
  }
}
