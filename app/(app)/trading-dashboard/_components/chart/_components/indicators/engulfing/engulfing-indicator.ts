import type { EngulfingOverlayEvent } from './engulfing-overlay-primitive'
import { EngulfingOverlayPrimitive } from './engulfing-overlay-primitive'

/** Owns engulfing overlay updates; the primitive owns chart painting. */
export class EngulfingIndicator {
  readonly primitive = new EngulfingOverlayPrimitive()

  setEvents(events: readonly EngulfingOverlayEvent[]): void {
    this.primitive.setEvents(events)
  }
}
