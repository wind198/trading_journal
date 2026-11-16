import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type {
  Editable,
  InteractionEvent,
  InteractionResult,
} from '../interaction-contract'

export type TwoPointEditInput = {
  id: string
  endpoint: 'p1' | 'p2'
  p1: DrawingPoint
  p2: DrawingPoint
}

export type TwoPointEditState = { mode: 'edit' } & TwoPointEditInput

/** Shared endpoint-drag edit policy for two-point drawings. */
export class TwoPointEditBehavior implements Editable<TwoPointEditState, TwoPointEditInput> {
  constructor(readonly id: string) {}

  beginEditing(input: TwoPointEditInput): InteractionResult<TwoPointEditState> {
    return { state: { mode: 'edit', ...input }, status: 'active' }
  }

  continueEditing(
    state: TwoPointEditState,
    event: InteractionEvent,
  ): InteractionResult<TwoPointEditState> {
    if (event.type === 'cancel') {
      return { state, status: 'cancelled' }
    }
    if (event.type === 'pointer-move') {
      const point = event.pointer.chartPoint
      if (!point) return { state, status: 'active' }
      const next = state.endpoint === 'p1'
        ? { ...state, p1: point }
        : { ...state, p2: point }
      return {
        state: next,
        status: 'active',
        effects: [{ scopeId: this.id, type: 'change', payload: next }],
      }
    }
    if (event.type === 'confirm' || event.type === 'chart-click' || event.type === 'pointer-up') {
      return {
        state,
        status: 'committed',
        effects: [{ scopeId: this.id, type: 'change-end', payload: { id: state.id } }],
      }
    }
    return { state, status: 'active' }
  }
}
