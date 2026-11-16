export type DrawingLabelState =
  | { status: 'closed' }
  | { status: 'editing'; id: string; kind: string | null; original: string; draft: string }

/** Owns the unsaved label draft; the host owns rendering and persistence. */
export class DrawingLabelSession {
  private current: DrawingLabelState = { status: 'closed' }

  get state(): Readonly<DrawingLabelState> { return this.current }

  open(input: { id: string; kind: string | null; label: string }): void {
    this.current = { status: 'editing', id: input.id, kind: input.kind, original: input.label, draft: input.label }
  }

  changeDraft(draft: string): void {
    if (this.current.status !== 'editing') return
    this.current = { ...this.current, draft }
  }

  save(): { id: string; kind: string | null; label: string } | null {
    if (this.current.status !== 'editing') return null
    const result = { id: this.current.id, kind: this.current.kind, label: this.current.draft }
    this.current = { status: 'closed' }
    return result
  }

  cancel(): void { this.current = { status: 'closed' } }
  dispose(): void { this.cancel() }
}
