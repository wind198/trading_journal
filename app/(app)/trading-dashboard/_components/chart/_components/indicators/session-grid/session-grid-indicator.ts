import type { BarTimeSeries } from '../../../../../_lib/chart/chart-coordinates'
import { SessionVerticalLinesPrimitive } from './session-vertical-lines-primitive'

/** Owns session guide inputs; the pane primitive manages its visible-range listener. */
export class SessionGridIndicator {
  readonly primitive = new SessionVerticalLinesPrimitive()

  setBars(bars: BarTimeSeries): void {
    this.primitive.setBars(bars)
  }

  setEnabledSlots(enabled: ReadonlySet<string> | null): void {
    this.primitive.setEnabledSlots(enabled)
  }
}
