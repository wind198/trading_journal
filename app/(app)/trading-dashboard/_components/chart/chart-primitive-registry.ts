/** Chart-owned registry: hitBoost + draft routing without N-way switches. */

export type ChartPrimitiveLayer = {
  setHitBoost(boost: number): void
  setDraft(draft: unknown): void
  getDraft(): unknown
}

/** Adapts a typed primitive into the registry's erased layer boundary. */
export function asPrimitiveLayer<T>(layer: {
  setHitBoost(boost: number): void
  setDraft(draft: T | null): void
  draft: T | null
}): ChartPrimitiveLayer {
  return {
    setHitBoost: (boost) => layer.setHitBoost(boost),
    setDraft: (draft) => layer.setDraft(draft as T | null),
    getDraft: () => layer.draft,
  }
}

export class ChartPrimitiveRegistry {
  private readonly layers = new Map<string, ChartPrimitiveLayer>()

  register(scopeId: string, layer: ChartPrimitiveLayer): () => void {
    if (this.layers.has(scopeId)) throw new Error(`Primitive already registered: ${scopeId}`)
    this.layers.set(scopeId, layer)
    return () => {
      if (this.layers.get(scopeId) === layer) this.layers.delete(scopeId)
    }
  }

  setHitBoost(boost: number): void {
    for (const layer of this.layers.values()) layer.setHitBoost(boost)
  }

  setDraft(scopeId: string, draft: unknown): void {
    for (const [id, layer] of this.layers) {
      if (id !== scopeId && layer.getDraft()) layer.setDraft(null)
    }
    this.layers.get(scopeId)?.setDraft(draft)
  }

  clearDrafts(): void {
    for (const layer of this.layers.values()) {
      if (layer.getDraft()) layer.setDraft(null)
    }
  }
}
