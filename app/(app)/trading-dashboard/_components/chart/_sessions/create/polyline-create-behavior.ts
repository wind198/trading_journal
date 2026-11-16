import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type {
  Creatable,
  InteractionEvent,
  InteractionResult,
} from '../interaction-contract'

export const POLYLINE_SCOPE_ID = 'polyline_arrow' as const

export type PolylineCreateState = {
  points: DrawingPoint[]
  hover: DrawingPoint | null
  lastTap: { time: number; x: number; y: number } | null
}

export type PolylineCreateInput = {
  point: DrawingPoint
  clientX: number
  clientY: number
}

export type PolylineCreateOptions = {
  doubleTapMs: number
  doubleTapPx: number
}

/** Multi-point polyline create with double-tap completion. */
export class PolylineCreateBehavior implements Creatable<PolylineCreateState, PolylineCreateInput> {
  readonly id = POLYLINE_SCOPE_ID

  constructor(private readonly options: PolylineCreateOptions) {}

  beginCreation(input: PolylineCreateInput): InteractionResult<PolylineCreateState> {
    const state: PolylineCreateState = {
      points: [input.point],
      hover: null,
      lastTap: { time: Date.now(), x: input.clientX, y: input.clientY },
    }
    return {
      state,
      status: 'active',
      effects: [this.effect('polyline-preview', { points: state.points })],
    }
  }

  continueCreation(
    state: PolylineCreateState,
    event: InteractionEvent,
  ): InteractionResult<PolylineCreateState> {
    if (event.type === 'cancel') {
      return {
        state: { points: [], hover: null, lastTap: null },
        status: 'cancelled',
        effects: [this.effect('clear-preview')],
      }
    }
    if (event.type === 'pointer-move') {
      const hover = event.pointer.chartPoint
      if (!hover || state.points.length === 0) return { state, status: 'active' }
      const next = { ...state, hover }
      return {
        state: next,
        status: 'active',
        effects: [this.effect('polyline-preview', { points: state.points, hover })],
      }
    }
    if (event.type === 'pointer-up' || event.type === 'confirm' || event.type === 'chart-click') {
      const point = event.type === 'pointer-up' ? event.pointer.chartPoint : null
      const screen = event.type === 'pointer-up' ? event.pointer.screen : null
      if (!point || !screen) return { state, status: 'active' }
      return this.tap(state, point, screen.x, screen.y)
    }
    return { state, status: 'active' }
  }

  private tap(
    state: PolylineCreateState,
    point: DrawingPoint,
    clientX: number,
    clientY: number,
  ): InteractionResult<PolylineCreateState> {
    const previous = state.lastTap
    const now = Date.now()
    if (
      previous &&
      now - previous.time <= this.options.doubleTapMs &&
      Math.hypot(clientX - previous.x, clientY - previous.y) <= this.options.doubleTapPx
    ) {
      const points = [...state.points, point]
      if (points.length >= 2) {
        return {
          state: { points: [], hover: null, lastTap: null },
          status: 'committed',
          effects: [
            this.effect('polyline-complete', { points }),
            this.effect('clear-preview'),
          ],
        }
      }
      return { state: { ...state, lastTap: null }, status: 'active' }
    }
    const points = [...state.points, point]
    const next: PolylineCreateState = {
      points,
      hover: null,
      lastTap: { time: now, x: clientX, y: clientY },
    }
    return {
      state: next,
      status: 'active',
      effects: [this.effect('polyline-preview', { points })],
    }
  }

  private effect(type: string, payload?: unknown) {
    return { scopeId: this.id, type, payload }
  }
}
