import type { DojiOverlayEvent } from './doji-overlay-primitive'
import { DojiOverlayPrimitive } from './doji-overlay-primitive'

export class DojiIndicator {
  readonly primitive = new DojiOverlayPrimitive()

  setEvents(events: readonly DojiOverlayEvent[]): void {
    this.primitive.setEvents(events)
  }
}