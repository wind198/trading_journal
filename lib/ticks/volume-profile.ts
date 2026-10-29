import { createServiceClient } from '../supabase/admin'

export const VOLUME_PROFILE_WINDOW_MS = 24 * 60 * 60 * 1000
export const VOLUME_PROFILE_BIN_SIZE = 0.0001

export type VolumeProfileTickBin = {
  price: number
  tickCount: number
}

export async function fetchVolumeProfileTickCounts(options: {
  symbol: string
  fromMsc: number
  binSize?: number
}): Promise<VolumeProfileTickBin[]> {
  const binSize = options.binSize ?? VOLUME_PROFILE_BIN_SIZE
  if (!(binSize > 0) || !Number.isFinite(options.fromMsc)) {
    throw new Error('volume profile args')
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('volume_profile_tick_counts', {
    p_symbol: options.symbol,
    p_from_msc: options.fromMsc,
    p_bin_size: binSize,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: { price: number | string; tick_count: number | string }) => ({
    price: Number(row.price),
    tickCount: Number(row.tick_count),
  }))
}
