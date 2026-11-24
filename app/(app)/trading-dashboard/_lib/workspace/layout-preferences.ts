export const LAYOUT_STORAGE_KEY = 'trading-workspace-layout:v1'
export const MIN_WEIGHT = 15
export const MAX_WEIGHT = 85
export type LayoutPreferences = {
  focusMode: boolean
  fourPortrait: [number, number, number, number]
  fourWide: { row: number; column: number }
  focusPortrait: number
  focusWide: number
}
export const DEFAULT_LAYOUT: LayoutPreferences = {
  focusMode: false,
  fourPortrait: [25, 25, 25, 25],
  fourWide: { row: 50, column: 50 },
  focusPortrait: 50,
  focusWide: 50,
}
export function clampSplit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(25, Math.min(75, value)) : 50
}
export function normalizePortrait(value: unknown): LayoutPreferences['fourPortrait'] {
  if (!Array.isArray(value) || value.length !== 4 || value.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < MIN_WEIGHT || v > MAX_WEIGHT)) return [...DEFAULT_LAYOUT.fourPortrait]
  return [value[0], value[1], value[2], value[3]]
}
export function normalizeLayout(value: unknown): LayoutPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_LAYOUT
  const raw = value as Partial<LayoutPreferences>
  return {
    focusMode: raw.focusMode === true,
    fourPortrait: normalizePortrait(raw.fourPortrait),
    fourWide: { row: clampSplit(raw.fourWide?.row), column: clampSplit(raw.fourWide?.column) },
    focusPortrait: clampSplit(raw.focusPortrait),
    focusWide: clampSplit(raw.focusWide),
  }
}
export function resizePortrait(current: LayoutPreferences['fourPortrait'], index: number, value: number): LayoutPreferences['fourPortrait'] {
  const next = [...current] as LayoutPreferences['fourPortrait']
  if (Number.isInteger(index) && index >= 0 && index < 4 && Number.isFinite(value)) next[index] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, value))
  return next
}
export function splitTracks(value: number): string {
  const split = clampSplit(value)
  return `minmax(0, ${split}fr) minmax(0, ${100 - split}fr)`
}
export function portraitTracks(weights: LayoutPreferences['fourPortrait']): string {
  return normalizePortrait(weights).map(weight => `minmax(0, ${weight}fr)`).join(' ')
}
