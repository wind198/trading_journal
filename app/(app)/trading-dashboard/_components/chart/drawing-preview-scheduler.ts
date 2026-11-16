import type { DrawingPoint } from '../../_lib/chart/chart-drawings'

type Draft = { p1: DrawingPoint; p2?: DrawingPoint | null; p3?: DrawingPoint | null }

/** Coalesces drag previews to one update per frame and owns pending frame cleanup. */
export class DrawingPreviewScheduler {
  private frame: number | null = null
  private pending: Draft | null = null

  constructor(private readonly render: (draft: Draft) => void) {}

  schedule(p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null): void {
    this.pending = { p1, p2, p3 }
    if (this.frame != null) return
    this.frame = requestAnimationFrame(() => {
      this.frame = null
      const draft = this.pending
      this.pending = null
      if (draft) this.render(draft)
    })
  }

  flush(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame)
    this.frame = null
    const draft = this.pending
    this.pending = null
    if (draft) this.render(draft)
  }

  discard(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.pending = null
  }
}
