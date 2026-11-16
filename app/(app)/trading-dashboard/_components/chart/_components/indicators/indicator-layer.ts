import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { BarTimeSeries } from '../../../../_lib/chart/chart-coordinates'
import type { VolumeProfileFrame } from '../../../../_lib/chart/volume-profile'
import type { EngulfingOverlayEvent } from './engulfing/engulfing-overlay-primitive'
import { EngulfingIndicator } from './engulfing/engulfing-indicator'
import type { ForceOverlayEvent } from './force/force-overlay-primitive'
import { ForceIndicator } from './force/force-indicator'
import { SessionGridIndicator } from './session-grid/session-grid-indicator'
import { VolumeProfileIndicator } from './volume-profile/volume-profile-indicator'

/** Attaches indicators in the existing paint order and forwards their changing inputs. */
export class IndicatorLayer {
  readonly force = new ForceIndicator()
  readonly engulfing = new EngulfingIndicator()
  readonly volumeProfile: VolumeProfileIndicator | null
  readonly sessionGrid: SessionGridIndicator | null
  private readonly detachCallbacks: (() => void)[] = []
  private detached = false

  constructor(
    chart: IChartApi,
    price: ISeriesApi<SeriesType, Time>,
    options: { volumeProfile: boolean; sessionGrid: boolean },
  ) {
    price.attachPrimitive(this.force.primitive)
    this.detachCallbacks.push(() => price.detachPrimitive(this.force.primitive))
    price.attachPrimitive(this.engulfing.primitive)
    this.detachCallbacks.push(() => price.detachPrimitive(this.engulfing.primitive))

    this.volumeProfile = options.volumeProfile ? new VolumeProfileIndicator() : null
    this.sessionGrid = options.sessionGrid ? new SessionGridIndicator() : null

    if (this.volumeProfile) {
      price.attachPrimitive(this.volumeProfile.primitive)
      this.detachCallbacks.push(() => price.detachPrimitive(this.volumeProfile!.primitive))
    }
    if (this.sessionGrid) {
      const pane = chart.panes()[0]
      pane.attachPrimitive(this.sessionGrid.primitive)
      this.detachCallbacks.push(() => pane.detachPrimitive(this.sessionGrid!.primitive))
    }
  }

  setBars(bars: BarTimeSeries): void {
    this.volumeProfile?.setBars(bars)
    this.sessionGrid?.setBars(bars)
  }

  setForceEvents(events: readonly ForceOverlayEvent[]): void {
    this.force.setEvents(events)
  }

  setEngulfingEvents(events: readonly EngulfingOverlayEvent[]): void {
    this.engulfing.setEvents(events)
  }

  setVolumeProfile(profile: VolumeProfileFrame | null): void {
    this.volumeProfile?.setProfile(profile)
  }

  /** Releases primitives in reverse attachment order. Safe to call more than once. */
  detach(): void {
    if (this.detached) return
    this.detached = true
    for (const detach of this.detachCallbacks.reverse()) detach()
    this.detachCallbacks.length = 0
  }
}
