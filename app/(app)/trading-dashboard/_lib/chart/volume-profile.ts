export const VALUE_AREA_RATIO = 0.7
export const VOLUME_PROFILE_BIN_SIZE = 0.0001

export type VolumeProfileBin = {
  price: number
  tickCount: number
}

export type VolumeProfileFrame = {
  bins: VolumeProfileBin[]
  poc: number
  vah: number
  val: number
}

/** POC = max tick-count bin (lowest price on ties). VAH/VAL = 70% value-area edges. */
export function buildVolumeProfile(
  bins: readonly VolumeProfileBin[],
  binSize = VOLUME_PROFILE_BIN_SIZE,
): VolumeProfileFrame | null {
  if (bins.length === 0 || !(binSize > 0)) return null
  const sorted = [...bins]
    .filter((bin) => Number.isFinite(bin.price) && bin.tickCount > 0)
    .sort((a, b) => a.price - b.price)
  if (sorted.length === 0) return null

  const total = sorted.reduce((sum, bin) => sum + bin.tickCount, 0)
  if (total <= 0) return null

  let pocIndex = 0
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].tickCount > sorted[pocIndex].tickCount) pocIndex = i
  }

  const target = total * VALUE_AREA_RATIO
  let lo = pocIndex
  let hi = pocIndex
  let acc = sorted[pocIndex].tickCount

  while (acc < target) {
    const canUp = hi < sorted.length - 1
    const canDown = lo > 0
    if (!canUp && !canDown) break
    const upVol = canUp ? sorted[hi + 1].tickCount : -1
    const downVol = canDown ? sorted[lo - 1].tickCount : -1
    if (upVol > downVol) {
      hi += 1
      acc += sorted[hi].tickCount
    } else if (downVol > upVol) {
      lo -= 1
      acc += sorted[lo].tickCount
    } else {
      hi += 1
      acc += sorted[hi].tickCount
      if (acc < target && lo > 0) {
        lo -= 1
        acc += sorted[lo].tickCount
      }
    }
  }

  const half = binSize / 2
  return {
    bins: sorted,
    poc: sorted[pocIndex].price,
    vah: sorted[hi].price + half,
    val: sorted[lo].price - half,
  }
}
