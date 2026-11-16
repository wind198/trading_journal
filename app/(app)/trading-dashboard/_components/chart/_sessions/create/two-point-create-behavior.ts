import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type {
  Creatable,
  InteractionEvent,
  InteractionResult,
} from '../interaction-contract'
import { decideCoarseTwoPointConfirm } from './coarse-two-point-confirm'

export type TwoPointToolKind = 'rectangle' | 'trendline' | 'fibonacci_range' | 'warning_circle'

export type TwoPointCreateState =
  | { pointer: 'fine'; p1: DrawingPoint; p2: DrawingPoint | null }
  | { pointer: 'coarse'; phase: 'placing_p1'; p1: DrawingPoint }
  | { pointer: 'coarse'; phase: 'placing_p2'; p1: DrawingPoint; p2: DrawingPoint }

export type TwoPointCreateInput =
  | { pointer?: 'fine'; p1: DrawingPoint; p2?: DrawingPoint | null }
  | { pointer: 'coarse'; p1: DrawingPoint }

export type TwoPointCreateDefaults = {
  secondPoint: (p1: DrawingPoint) => DrawingPoint
}

/** Stateless two-point create for fine taps and coarse seed/drag/confirm. */
export class TwoPointCreateBehavior implements Creatable<TwoPointCreateState, TwoPointCreateInput> {
  constructor(
    readonly id: TwoPointToolKind,
    private readonly defaults?: TwoPointCreateDefaults,
  ) {}

  beginCreation(input: TwoPointCreateInput): InteractionResult<TwoPointCreateState> {
    if (input.pointer === 'coarse') {
      const state: TwoPointCreateState = { pointer: 'coarse', phase: 'placing_p1', p1: input.p1 }
      return { state, status: 'active', effects: [this.effect('preview', { p1: state.p1, p2: null })] }
    }
    const state: TwoPointCreateState = {
      pointer: 'fine',
      p1: input.p1,
      p2: input.p2 ?? null,
    }
    return { state, status: 'active', effects: [this.effect('preview', state)] }
  }

  continueCreation(
    state: TwoPointCreateState,
    event: InteractionEvent,
  ): InteractionResult<TwoPointCreateState> {
    if (event.type === 'cancel') {
      return { state, status: 'cancelled', effects: [this.effect('clear-preview')] }
    }
    if (event.type === 'pointer-move') {
      const point = event.pointer.chartPoint
      if (state.pointer === 'fine') {
        const next = { ...state, p2: point }
        return { state: next, status: 'active', effects: [this.effect('preview', next)] }
      }
      if (!point || !Number.isFinite(point.time) || !Number.isFinite(point.price) || point.time <= 0) {
        return { state, status: 'active' }
      }
      if (state.phase === 'placing_p1') {
        const next = { ...state, p1: point }
        return {
          state: next,
          status: 'active',
          effects: [this.effect('preview-scheduled', { p1: point, p2: null })],
        }
      }
      const next = { ...state, p2: point }
      return {
        state: next,
        status: 'active',
        effects: [this.effect('preview-scheduled', { p1: state.p1, p2: point })],
      }
    }
    if (event.type === 'confirm' || event.type === 'chart-click' || event.type === 'pointer-up') {
      if (state.pointer === 'fine') {
        if (!state.p2) return { state, status: 'active' }
        return {
          state,
          status: 'committed',
          effects: [
            this.effect('complete', { kind: this.id, p1: state.p1, p2: state.p2 }),
            this.effect('clear-preview'),
          ],
        }
      }
      const defaultP2 = state.phase === 'placing_p1' && this.defaults
        ? this.defaults.secondPoint(state.p1)
        : null
      const decision = decideCoarseTwoPointConfirm(
        state.phase === 'placing_p1'
          ? { phase: 'placing_p1', p1: state.p1 }
          : { phase: 'placing_p2', p1: state.p1, p2: state.p2 },
        defaultP2,
      )
      if (decision.kind === 'place_second') {
        const next: TwoPointCreateState = {
          pointer: 'coarse',
          phase: 'placing_p2',
          p1: decision.p1,
          p2: decision.p2,
        }
        return {
          state: next,
          status: 'active',
          effects: [this.effect('preview', { p1: decision.p1, p2: decision.p2 })],
        }
      }
      if (decision.kind === 'complete') {
        return {
          state,
          status: 'committed',
          effects: [
            this.effect('complete', { kind: this.id, p1: decision.p1, p2: decision.p2 }),
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

export const TWO_POINT_CREATE_KINDS = [
  'rectangle',
  'trendline',
  'fibonacci_range',
  'warning_circle',
] as const satisfies readonly TwoPointToolKind[]

export function isTwoPointCreateKind(tool: string | null): tool is TwoPointToolKind {
  return tool === 'rectangle' || tool === 'trendline' || tool === 'fibonacci_range' || tool === 'warning_circle'
}

export function activeTwoPointAnchor(state: TwoPointCreateState): DrawingPoint | null {
  if (state.pointer === 'fine') return state.p2 ?? state.p1
  if (state.phase === 'placing_p1') return state.p1
  return state.p2
}
