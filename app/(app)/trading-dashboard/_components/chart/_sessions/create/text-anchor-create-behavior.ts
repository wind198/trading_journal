import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type { Creatable, InteractionEvent, InteractionResult } from '../interaction-contract'

export type TextCreateState = { pointer: 'fine' | 'coarse'; p1: DrawingPoint }
export class TextAnchorCreateBehavior implements Creatable<TextCreateState, TextCreateState> {
  readonly id = 'text_anchor'
  beginCreation(state: TextCreateState): InteractionResult<TextCreateState> {
    return { state, status: 'active', effects: [{ scopeId: this.id, type: 'preview', payload: { p1: state.p1 } }] }
  }
  continueCreation(state: TextCreateState, event: InteractionEvent): InteractionResult<TextCreateState> {
    if (event.type === 'cancel') return { state, status: 'cancelled', effects: [{ scopeId: this.id, type: 'clear-preview' }] }
    if (event.type === 'pointer-move') {
      const point = event.pointer.chartPoint
      if (!point || !Number.isFinite(point.time) || !Number.isFinite(point.price) || point.time <= 0) return { state, status: 'active' }
      const next = { ...state, p1: point }
      return { state: next, status: 'active', effects: [{ scopeId: this.id, type: 'preview-scheduled', payload: { p1: point } }] }
    }
    if (event.type === 'confirm') return { state, status: 'committed', effects: [{ scopeId: this.id, type: 'complete', payload: { kind: this.id, p1: state.p1, p2: state.p1 } }, { scopeId: this.id, type: 'clear-preview' }] }
    return { state, status: 'active' }
  }
}
