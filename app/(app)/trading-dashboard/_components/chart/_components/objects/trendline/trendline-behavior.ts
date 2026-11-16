import type {
  Creatable,
  Editable,
  InteractionEvent,
  InteractionResult,
} from '../../../_sessions/interaction-contract'
import {
  TwoPointCreateBehavior,
  type TwoPointCreateInput,
  type TwoPointCreateState,
} from '../../../_sessions/create/two-point-create-behavior'
import {
  TwoPointEditBehavior,
  type TwoPointEditInput,
  type TwoPointEditState,
} from '../../../_sessions/edit/two-point-edit-behavior'

/** Trendline create/edit policy; create may stay registered via shared TwoPointCreateBehavior. */
export class TrendlineBehavior implements
  Creatable<TwoPointCreateState, TwoPointCreateInput>,
  Editable<TwoPointEditState, TwoPointEditInput> {
  readonly id = 'trendline'
  private readonly create = new TwoPointCreateBehavior('trendline')
  private readonly edit = new TwoPointEditBehavior('trendline')

  beginCreation(input: TwoPointCreateInput): InteractionResult<TwoPointCreateState> {
    return this.create.beginCreation(input)
  }

  continueCreation(
    state: TwoPointCreateState,
    event: InteractionEvent,
  ): InteractionResult<TwoPointCreateState> {
    return this.create.continueCreation(state, event)
  }

  beginEditing(input: TwoPointEditInput): InteractionResult<TwoPointEditState> {
    return this.edit.beginEditing(input)
  }

  continueEditing(
    state: TwoPointEditState,
    event: InteractionEvent,
  ): InteractionResult<TwoPointEditState> {
    return this.edit.continueEditing(state, event)
  }
}
