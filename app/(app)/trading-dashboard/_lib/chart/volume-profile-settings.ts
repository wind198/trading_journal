export const VP_BIN_COUNTS = [20,30,40] as const
export type VolumeProfileSettings = { lookback:number; bins: (typeof VP_BIN_COUNTS)[number] }
export const DEFAULT_VP_SETTINGS: VolumeProfileSettings = {lookback:96,bins:30}
export const MIN_VP_LOOKBACK=1
export const MAX_VP_LOOKBACK=1000
export function normalizeVolumeProfileSettings(raw:unknown):VolumeProfileSettings {
  const v=raw as Partial<VolumeProfileSettings>|null
  return {lookback:Number.isInteger(v?.lookback)&&v!.lookback!>=MIN_VP_LOOKBACK&&v!.lookback!<=MAX_VP_LOOKBACK?v!.lookback!:96,bins:VP_BIN_COUNTS.includes(v?.bins as VolumeProfileSettings['bins'])?v!.bins!:30}
}
/** Equal-width bins, anchored at the observed candle low. Flat ranges use a one-tick minimum width. */
export function volumeProfilePriceGrid(candles:readonly {low:number;high:number}[], settings:VolumeProfileSettings) {
  const slice=candles.slice(-settings.lookback)
  if(!slice.length)return null
  const low=Math.min(...slice.map(c=>c.low)),high=Math.max(...slice.map(c=>c.high))
  if(!Number.isFinite(low)||!Number.isFinite(high)||low<=0||high<low)return null
  return {low,high,binSize:Math.max(0.00001,(high-low)/settings.bins),bins:settings.bins}
}
