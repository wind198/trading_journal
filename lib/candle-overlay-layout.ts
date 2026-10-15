/**
 * Shared layout for per-candle overlays (force, engulfing, …).
 * Markers are horizontally centered on the candle; vertically outside the wick
 * with a buffer (above high for bearish, below low for bullish).
 */
export const CANDLE_OVERLAY_STACK = {
  force: 0,
  engulfing: 1,
} as const

export type CandleOverlayStackKey = keyof typeof CANDLE_OVERLAY_STACK

/** Fraction of inter-bar spacing used as max candle body width (LWC ~ default body). */
export const CANDLE_BODY_WIDTH_FRAC = 0.7

/** Marker diameter/side as fraction of candle body width (1.5×). */
export const OVERLAY_MARKER_SIZE_FRAC = 1.5

/** Gap between wick tip and marker edge (and between stacked markers). */
export const OVERLAY_MARKER_GAP_FRAC = 0.15

const MIN_MARKER_PX = 5
const MIN_GAP_PX = 2

/**
 * Horizontally center on the bar. Place outside the wick:
 * - bullish → below `yLow` (screen Y increases downward)
 * - bearish → above `yHigh`
 * `stackIndex` 0 is closest to the wick; higher indexes push further out.
 */
export function overlayMarkerGeometry(
  barCenterX: number,
  barSpacing: number,
  stackIndex: number,
  yHigh: number,
  yLow: number,
  bullish: boolean,
): { cx: number; cy: number; size: number } {
  const bodyWidth = Math.max(1, barSpacing * CANDLE_BODY_WIDTH_FRAC)
  const size = Math.max(MIN_MARKER_PX, bodyWidth * OVERLAY_MARKER_SIZE_FRAC)
  const gap = Math.max(MIN_GAP_PX, bodyWidth * OVERLAY_MARKER_GAP_FRAC)
  const half = size / 2
  // Distance from wick tip to marker center for this stack slot.
  const outward = gap + half + stackIndex * (size + gap)
  const cy = bullish ? yLow + outward : yHigh - outward
  return { cx: barCenterX, cy, size }
}
