import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type {
  Creatable,
  InteractionEvent,
  InteractionResult,
} from '../interaction-contract'
import { decideCoarseThreePointConfirm } from './coarse-three-point-confirm'

export const EXTENSION_SCOPE_ID = 'fibonacci_range_extension' as const

export type ThreePointToolKind = typeof EXTENSION_SCOPE_ID | 'parallel_channel'
export function isThreePointTool(tool: unknown): tool is ThreePointToolKind { return tool === EXTENSION_SCOPE_ID || tool === 'parallel_channel' }

export type ThreePointCreateState =
  | { pointer: 'fine'; status: 'first'; p1: DrawingPoint; hover?: DrawingPoint | null }
  | { pointer: 'fine'; status: 'second'; p1: DrawingPoint; p2: DrawingPoint; hover?: DrawingPoint | null }
  | { pointer: 'coarse'; phase: 'placing_p1'; p1: DrawingPoint }
  | { pointer: 'coarse'; phase: 'placing_p2'; p1: DrawingPoint; p2: DrawingPoint }
  | { pointer: 'coarse'; phase: 'placing_p3'; p1: DrawingPoint; p2: DrawingPoint; p3: DrawingPoint }

export type ThreePointCreateInput =
  | { pointer?: 'fine'; p1: DrawingPoint }
  | { pointer: 'coarse'; p1: DrawingPoint }

export type ThreePointCreateDefaults = {
  secondPoint: (p1: DrawingPoint) => DrawingPoint
  thirdPoint: (p1: DrawingPoint, p2: DrawingPoint) => DrawingPoint
}

function previewPayload(state: ThreePointCreateState) {
  if (state.pointer === 'fine') {
    if (state.status === 'first') {
      return { p1: state.p1, p2: state.hover ?? undefined, p3: undefined }
    }
    return { p1: state.p1, p2: state.p2, p3: state.hover ?? undefined }
  }
  if (state.phase === 'placing_p1') return { p1: state.p1, p2: null, p3: null }
  if (state.phase === 'placing_p2') return { p1: state.p1, p2: state.p2, p3: null }
  return { p1: state.p1, p2: state.p2, p3: state.p3 }
}

/** Fine and coarse Fibonacci extension create policy. */
export class ThreePointCreateBehavior implements Creatable<ThreePointCreateState, ThreePointCreateInput> {
  constructor(private readonly defaults?: ThreePointCreateDefaults, readonly id: ThreePointToolKind = EXTENSION_SCOPE_ID) {}

  beginCreation(input: ThreePointCreateInput): InteractionResult<ThreePointCreateState> {
    if (input.pointer === 'coarse') {
      const state: ThreePointCreateState = { pointer: 'coarse', phase: 'placing_p1', p1: input.p1 }
      return { state, status: 'active', effects: [this.effect('preview', previewPayload(state))] }
    }
    const state: ThreePointCreateState = { pointer: 'fine', status: 'first', p1: input.p1 }
    return { state, status: 'active', effects: [this.effect('preview', previewPayload(state))] }
  }

  continueCreation(
    state: ThreePointCreateState,
    event: InteractionEvent,
  ): InteractionResult<ThreePointCreateState> {
    if (event.type === 'cancel') {
      return { state, status: 'cancelled', effects: [this.effect('clear-preview')] }
    }
    if (event.type === 'pointer-move') {
      const point = event.pointer.chartPoint
      if (state.pointer === 'fine') {
        if (!point) return { state, status: 'active' }
        const next = { ...state, hover: point }
        return { state: next, status: 'active', effects: [this.effect('preview', previewPayload(next))] }
      }
      if (!point || !Number.isFinite(point.time) || !Number.isFinite(point.price) || point.time <= 0) {
        return { state, status: 'active' }
      }
      let next: ThreePointCreateState
      if (state.phase === 'placing_p1') next = { ...state, p1: point }
      else if (state.phase === 'placing_p2') next = { ...state, p2: point }
      else next = { ...state, p3: point }
      return {
        state: next,
        status: 'active',
        effects: [this.effect('preview-scheduled', previewPayload(next))],
      }
    }
    if (event.type === 'confirm' || event.type === 'chart-click' || event.type === 'pointer-up') {
      if (state.pointer === 'fine') {
        const point = state.hover
        if (!point) return { state, status: 'active' }
        if (state.status === 'first') {
          if (this.id === 'parallel_channel' && Math.round(state.p1.time) === Math.round(point.time)) return { state, status: 'active' }
          const next: ThreePointCreateState = {
            pointer: 'fine', status: 'second', p1: state.p1, p2: point, hover: null,
          }
          return { state: next, status: 'active', effects: [this.effect('preview', previewPayload(next))] }
        }
        return {
          state,
          status: 'committed',
          effects: [
            this.effect('complete', {
              kind: this.id,
              p1: state.p1,
              p2: point,
              points: [state.p1, state.p2, point],
            }),
            this.effect('clear-preview'),
          ],
        }
      }
      const defaultPoint = !this.defaults
        ? null
        : state.phase === 'placing_p1'
          ? this.defaults.secondPoint(state.p1)
          : state.phase === 'placing_p2'
            ? this.defaults.thirdPoint(state.p1, state.p2)
            : null
      const decision = decideCoarseThreePointConfirm(
        state.phase === 'placing_p1'
          ? { phase: 'placing_p1', p1: state.p1 }
          : state.phase === 'placing_p2'
            ? { phase: 'placing_p2', p1: state.p1, p2: state.p2 }
            : { phase: 'placing_p3', p1: state.p1, p2: state.p2, p3: state.p3 },
        defaultPoint,
      )
      if (decision.kind === 'place_second') {
        const next: ThreePointCreateState = {
          pointer: 'coarse', phase: 'placing_p2', p1: decision.p1, p2: decision.p2,
        }
        return { state: next, status: 'active', effects: [this.effect('preview', previewPayload(next))] }
      }
      if (decision.kind === 'place_third') {
        if (this.id === 'parallel_channel' && Math.round(decision.p1.time) === Math.round(decision.p2.time)) return { state, status: 'active' }
        const next: ThreePointCreateState = {
          pointer: 'coarse',
          phase: 'placing_p3',
          p1: decision.p1,
          p2: decision.p2,
          p3: decision.p3,
        }
        return { state: next, status: 'active', effects: [this.effect('preview', previewPayload(next))] }
      }
      if (decision.kind === 'complete') {
        return {
          state,
          status: 'committed',
          effects: [
            this.effect('complete', {
              kind: this.id,
              p1: decision.p1,
              p2: decision.p3,
              points: [decision.p1, decision.p2, decision.p3],
            }),
            this.effect('clear-preview'),
          ],
        }
      }
    }
    return { state, status: 'active' }
  }

  private effect(type: string, payload?: unknown) {
    return { scopeId: this.id, type, payload }
  }
}

export function activeThreePointAnchor(state: ThreePointCreateState): DrawingPoint | null {
  if (state.pointer === 'fine') return state.hover ?? (state.status === 'first' ? state.p1 : state.p2)
  if (state.phase === 'placing_p1') return state.p1
  if (state.phase === 'placing_p2') return state.p2
  return state.p3
}
