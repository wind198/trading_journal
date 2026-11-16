export type WorkflowKind = 'create' | 'edit' | 'select' | 'configure'
export type InteractionStatus = 'active' | 'committed' | 'cancelled'
export type InteractionCancelReason = 'replaced' | 'tool-change' | 'pointer-cancel' | 'chart-dispose' | 'user'

export type ScreenPoint = { x: number; y: number }

export type NormalizedPointer = {
  pointerId: number
  pointerType: string
  coarse: boolean
  primary: boolean
  screen: ScreenPoint
  chartPoint: { time: number; price: number } | null
}

export type InteractionEvent =
  | { type: 'pointer-down'; pointer: NormalizedPointer }
  | { type: 'pointer-move'; pointer: NormalizedPointer }
  | { type: 'pointer-up'; pointer: NormalizedPointer }
  | { type: 'pointer-cancel'; pointerId: number }
  | { type: 'chart-click'; point: ScreenPoint | null }
  | { type: 'double-click'; point: ScreenPoint }
  | { type: 'crosshair-move'; point: ScreenPoint | null }
  | { type: 'confirm' }
  | { type: 'cancel'; reason: InteractionCancelReason }

export type InteractionEffect = {
  scopeId: string
  type: string
  payload?: unknown
}

export type InteractionResult<State> = {
  state: State
  status: InteractionStatus
  effects?: readonly InteractionEffect[]
}

export type WorkflowRequest = {
  scopeId: string
  workflow: WorkflowKind
  pointerId?: number
  input?: unknown
}

export interface WorkflowScope {
  readonly id: string
}

export interface Creatable<State, Input = unknown> extends WorkflowScope {
  beginCreation(input: Input): InteractionResult<State> | null
  continueCreation(state: State, event: InteractionEvent): InteractionResult<State>
}

export interface Editable<State, Input = unknown> extends WorkflowScope {
  beginEditing(input: Input): InteractionResult<State> | null
  continueEditing(state: State, event: InteractionEvent): InteractionResult<State>
}

export interface Selectable<State, Input = unknown> extends WorkflowScope {
  beginSelection(input: Input): InteractionResult<State> | null
  continueSelection(state: State, event: InteractionEvent): InteractionResult<State>
}

export interface Configurable<State, Input = unknown> extends WorkflowScope {
  beginConfiguration(input: Input): InteractionResult<State> | null
  continueConfiguration(state: State, event: InteractionEvent): InteractionResult<State>
}

export type RegisteredWorkflow = {
  scopeId: string
  workflow: WorkflowKind
  begin(input: unknown): InteractionResult<unknown> | null
  transition(state: unknown, event: InteractionEvent): InteractionResult<unknown>
}

export type InteractionSnapshot =
  | { status: 'idle' }
  | {
      status: 'active'
      scopeId: string
      workflow: WorkflowKind
      pointerId: number | null
      state: unknown
    }

export type InteractionListener = (snapshot: InteractionSnapshot) => void
