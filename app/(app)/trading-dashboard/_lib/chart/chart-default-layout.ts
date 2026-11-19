export const DEFAULT_VISIBLE_BARS = 200
export const DEFAULT_PRICE_SCALE_MARGIN = 0.1

export function defaultChartLayout(candleCount: number): {
  logicalRange: { from: number; to: number }
  scaleMargins: { top: number; bottom: number }
} {
  const count = Math.max(0, candleCount)
  const to = Math.max(0, count - 1)
  return {
    logicalRange: { from: Math.max(0, count - DEFAULT_VISIBLE_BARS), to },
    scaleMargins: {
      top: DEFAULT_PRICE_SCALE_MARGIN,
      bottom: DEFAULT_PRICE_SCALE_MARGIN,
    },
  }
}
