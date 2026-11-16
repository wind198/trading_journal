import type { ForceOverlayEvent } from './force-overlay-primitive'
import { ForceOverlayPrimitive } from './force-overlay-primitive'

/** Owns force overlay updates; the primitive owns chart painting. */
export class ForceIndicator {
  readonly primitive = new ForceOverlayPrimitive()

  setEvents(events: readonly ForceOverlayEvent[]): void {
    this.primitive.setEvents(events)
  }
}
