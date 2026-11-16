import type { Configurable, Creatable, Editable, RegisteredWorkflow, Selectable, WorkflowKind } from './interaction-contract'

type RegisteredOwner = { workflow: RegisteredWorkflow; priority: number }

/** Stores interaction owners and generic resolution priority without knowing their scopes. */
export class InteractionOwnerRegistry {
  private readonly owners = new Map<string, RegisteredOwner>()

  registerCreation<State, Input>(scope: Creatable<State, Input>, priority = 0): () => void {
    return this.register({ scopeId: scope.id, workflow: 'create', begin: (input) => scope.beginCreation(input as Input), transition: (state, event) => scope.continueCreation(state as State, event) }, priority)
  }

  registerEditing<State, Input>(scope: Editable<State, Input>, priority = 0): () => void {
    return this.register({ scopeId: scope.id, workflow: 'edit', begin: (input) => scope.beginEditing(input as Input), transition: (state, event) => scope.continueEditing(state as State, event) }, priority)
  }

  registerSelection<State, Input>(scope: Selectable<State, Input>, priority = 0): () => void {
    return this.register({ scopeId: scope.id, workflow: 'select', begin: (input) => scope.beginSelection(input as Input), transition: (state, event) => scope.continueSelection(state as State, event) }, priority)
  }

  registerConfiguration<State, Input>(scope: Configurable<State, Input>, priority = 0): () => void {
    return this.register({ scopeId: scope.id, workflow: 'configure', begin: (input) => scope.beginConfiguration(input as Input), transition: (state, event) => scope.continueConfiguration(state as State, event) }, priority)
  }

  get(scopeId: string, workflow: WorkflowKind): RegisteredWorkflow | null {
    return this.owners.get(this.key(scopeId, workflow))?.workflow ?? null
  }

  forWorkflow(workflow: WorkflowKind): readonly RegisteredWorkflow[] {
    return [...this.owners.values()]
      .filter((entry) => entry.workflow.workflow === workflow)
      .sort((a, b) => b.priority - a.priority)
      .map((entry) => entry.workflow)
  }

  clear(): void {
    this.owners.clear()
  }

  private register(workflow: RegisteredWorkflow, priority: number): () => void {
    const key = this.key(workflow.scopeId, workflow.workflow)
    if (this.owners.has(key)) throw new Error(`Workflow already registered: ${key}`)
    this.owners.set(key, { workflow, priority })
    return () => { if (this.owners.get(key)?.workflow === workflow) this.owners.delete(key) }
  }

  private key(scopeId: string, workflow: WorkflowKind): string { return `${scopeId}:${workflow}` }
}
