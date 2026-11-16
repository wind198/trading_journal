import type {
  RegisteredWorkflow,
  InteractionCancelReason,
  InteractionEvent,
  InteractionListener,
  InteractionResult,
  InteractionSnapshot,
  WorkflowRequest,
} from './interaction-contract'
import { InteractionEffectRunner } from './interaction-effect-runner'
import { InteractionOwnerRegistry } from './interaction-owner-registry'

type ActiveInteraction = {
  workflow: RegisteredWorkflow
  pointerId: number | null
  state: unknown
}

/** Owns one active interaction while treating its scope state as opaque. */
export class InteractionStore {
  private active: ActiveInteraction | null = null
  private readonly listeners = new Set<InteractionListener>()
  private disposed = false
  private readonly registry: InteractionOwnerRegistry
  private readonly effects: InteractionEffectRunner

  constructor(registry: InteractionOwnerRegistry, effects: InteractionEffectRunner) {
    this.registry = registry
    this.effects = effects
  }

  get snapshot(): InteractionSnapshot {
    const active = this.active
    return active
      ? {
          status: 'active',
          scopeId: active.workflow.scopeId,
          workflow: active.workflow.workflow,
          pointerId: active.pointerId,
          state: active.state,
        }
      : { status: 'idle' }
  }

  subscribe(listener: InteractionListener): () => void {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  begin(request: WorkflowRequest): boolean {
    if (this.disposed) return false
    const workflow = this.registry.get(request.scopeId, request.workflow)
    if (!workflow) return false
    if (this.active) this.cancel('replaced')
    const result = workflow.begin(request.input)
    if (!result) return false
    this.accept(workflow, request, result)
    return true
  }

  dispatch(event: InteractionEvent): boolean {
    if (this.disposed || !this.active) return false
    if (!this.acceptsPointer(event, this.active.pointerId)) return false
    const active = this.active
    const result = active.workflow.transition(active.state, event)
    this.accept(active.workflow, {
      scopeId: active.workflow.scopeId,
      workflow: active.workflow.workflow,
      pointerId: active.pointerId ?? undefined,
    }, result)
    return true
  }

  cancel(reason: InteractionCancelReason): void {
    if (!this.active) return
    this.dispatch({ type: 'cancel', reason })
    if (this.active) {
      this.active = null
      this.emit()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.cancel('chart-dispose')
    this.disposed = true
    this.listeners.clear()
    this.effects.dispose()
  }

  private accept(
    workflow: RegisteredWorkflow,
    request: WorkflowRequest,
    result: InteractionResult<unknown>,
  ): void {
    this.effects.run(result.effects)
    if (result.status === 'active') {
      this.active = {
        workflow,
        pointerId: request.pointerId ?? null,
        state: result.state,
      }
    } else {
      this.active = null
    }
    this.emit()
  }

  private acceptsPointer(event: InteractionEvent, activePointerId: number | null): boolean {
    if (activePointerId == null) return true
    switch (event.type) {
      case 'pointer-down':
      case 'pointer-move':
      case 'pointer-up':
        return event.pointer.pointerId === activePointerId
      case 'pointer-cancel':
        return event.pointerId === activePointerId
      default:
        return true
    }
  }

  private emit(): void {
    const snapshot = this.snapshot
    for (const listener of this.listeners) listener(snapshot)
  }
}
