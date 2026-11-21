import type { LightweightCandle } from '@/lib/ticks/candles'

/** Tuned values from trading_algorithms_python/trading_algorithms/double_pattern.py. */
export const DOUBLE_PATTERN_CONFIG = {
  pivotRadius: 5, atrPeriod: 14, similarity: 1, minDepth: 0.8,
  minGap: 5, maxGap: 60, breakBuffer: 0.1, invalidation: 0.25,
  expiry: 36, minScore: 55,
} as const

type Pivot = { i: number; at: number; type: 'H' | 'L'; price: number }
export type DoublePattern = {
  type: 'TOP' | 'BOTTOM'
  a: number
  m: number
  b: number
  firstConfirmed: number
  secondConfirmed: number
  formed: number
  decision: number
  state: 'CANDIDATE' | 'CONFIRMED' | 'INVALIDATED' | 'EXPIRED'
  neckline: number
  first: number
  second: number
  score: number
  atr: number
  time: number
  decisionTime: number | null
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export function detectDoublePatterns(candles: readonly LightweightCandle[]): DoublePattern[] {
  const cfg = DOUBLE_PATTERN_CONFIG
  const atr: number[] = []
  let previous = 0
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!
    const previousClose = i ? candles[i - 1]!.close : candle.close
    const tr = Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose))
    previous = i === 0 ? tr : (previous * (cfg.atrPeriod - 1) + tr) / cfg.atrPeriod
    atr.push(i >= cfg.atrPeriod - 1 ? previous : Number.NaN)
  }

  const pivots: Pivot[] = []
  const r = cfg.pivotRadius
  for (let i = r; i < candles.length - r; i++) {
    const candle = candles[i]!
    const window = candles.slice(i - r, i + r + 1)
    if (window.every((item, j) => j === r || candle.high > item.high)) {
      pivots.push({ i, at: i + r, type: 'H', price: candle.high })
    }
    if (window.every((item, j) => j === r || candle.low < item.low)) {
      pivots.push({ i, at: i + r, type: 'L', price: candle.low })
    }
  }
  pivots.sort((a, b) => a.i - b.i)

  const raw: DoublePattern[] = []
  for (let x = 0; x < pivots.length; x++) {
    const a = pivots[x]!
    for (let z = x + 2; z < pivots.length; z++) {
      const b = pivots[z]!
      const gap = b.i - a.i
      if (gap > cfg.maxGap) break
      if (a.type !== b.type || gap < cfg.minGap) continue
      const mids = pivots.slice(x + 1, z).filter((point) => point.type !== a.type)
      if (!mids.length) continue
      const top = a.type === 'H'
      const m = mids.reduce((best, point) =>
        top ? (point.price < best.price ? point : best) : (point.price > best.price ? point : best))
      const scale = atr[b.at]!
      if (!(scale > 0) || Math.abs(a.price - b.price) > cfg.similarity * scale) continue
      const depth = top ? Math.min(a.price, b.price) - m.price : m.price - Math.max(a.price, b.price)
      if (depth < cfg.minDepth * scale) continue
      const formed = Math.max(b.at, m.at)
      if (formed >= candles.length) continue
      const neckline = m.price
      let state: DoublePattern['state'] = 'CANDIDATE'
      let decision = -1
      const maxEnd = Math.min(candles.length - 1, formed + cfg.expiry)
      for (let j = formed + 1; j <= maxEnd; j++) {
        const close = candles[j]!.close
        if ((top && close > Math.max(a.price, b.price) + cfg.invalidation * scale) ||
            (!top && close < Math.min(a.price, b.price) - cfg.invalidation * scale)) {
          state = 'INVALIDATED'; decision = j; break
        }
        if ((top && close < neckline - cfg.breakBuffer * scale) ||
            (!top && close > neckline + cfg.breakBuffer * scale)) {
          state = 'CONFIRMED'; decision = j; break
        }
      }
      if (state === 'CANDIDATE' && maxEnd < candles.length - 1) {
        state = 'EXPIRED'; decision = maxEnd
      }
      const c = candles[b.i]!
      const span = c.high - c.low
      const reject = (top ? c.high - c.close : c.close - c.low) / Math.max(span, 1e-8)
      const sim = clamp(1 - Math.abs(a.price - b.price) / (cfg.similarity * scale))
      const dep = clamp(depth / (cfg.minDepth * scale * 2))
      const sep = clamp(gap / Math.max(cfg.minGap * 2, 1))
      const score = Math.floor(100 * (0.3 * sim + 0.25 * dep + 0.15 * sep + 0.2 * clamp(reject) + 0.05) + 0.5)
      raw.push({ type: top ? 'TOP' : 'BOTTOM', a: a.i, m: m.i, b: b.i,
        firstConfirmed: a.at, secondConfirmed: b.at, formed, decision, state,
        neckline, first: a.price, second: b.price, score, atr: scale,
        time: candles[formed]!.time, decisionTime: decision >= 0 ? candles[decision]!.time : null })
    }
  }
  const dedup = new Map<string, DoublePattern>()
  for (const pattern of raw) {
    const key = `${pattern.type}:${pattern.b}`
    const old = dedup.get(key)
    if (!old || pattern.score > old.score || (pattern.score === old.score && pattern.a > old.a)) dedup.set(key, pattern)
  }
  return [...dedup.values()].sort((a, b) => a.b - b.b)
}
