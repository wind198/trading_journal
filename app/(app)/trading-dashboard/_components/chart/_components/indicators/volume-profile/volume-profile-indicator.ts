import type { BarTimeSeries } from '../../../../../_lib/chart/chart-coordinates'
import type { VolumeProfileFrame } from '../../../../../_lib/chart/volume-profile'
import { VolumeProfilePrimitive } from './volume-profile-primitive'

/** Owns volume profile drawing inputs; profile calculation stays in the data layer. */
export class VolumeProfileIndicator {
  readonly primitive = new VolumeProfilePrimitive()

  setProfile(profile: VolumeProfileFrame | null): void {
    this.primitive.setProfile(profile)
  }

  setBars(bars: BarTimeSeries): void {
    this.primitive.setBars(bars)
  }
}
