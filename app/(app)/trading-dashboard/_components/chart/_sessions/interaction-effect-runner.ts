import type { InteractionEffect } from './interaction-contract'

export type InteractionEffectHandler = (effect: InteractionEffect) => void

/** Runs workflow effects in transition order; scope payloads remain opaque. */
export class InteractionEffectRunner {
  private disposed = false
  private readonly handler: InteractionEffectHandler

  constructor(handler: InteractionEffectHandler) {
    this.handler = handler
  }

  run(effects: readonly InteractionEffect[] | undefined): void {
    if (this.disposed || !effects) return
    for (const effect of effects) this.handler(effect)
  }

  dispose(): void {
    this.disposed = true
  }
}
