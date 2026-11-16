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

/** Rectangle create delegates to shared two-point policy; edit uses shared endpoint drag. */
export class RectangleBehavior implements
  Creatable<TwoPointCreateState, TwoPointCreateInput>,
  Editable<TwoPointEditState, TwoPointEditInput> {
  readonly id = 'rectangle'
  private readonly create = new TwoPointCreateBehavior('rectangle')
  private readonly edit = new TwoPointEditBehavior('rectangle')

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
