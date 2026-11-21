import type { LightweightCandle } from '@/lib/ticks/candles'

/** Tuned values from trading_algorithms_python/trading_algorithms/doji.py. */
const CONFIG = {
  n: 8, baseline: 100, trendBars: 24, atrPeriod: 14,
  minRange: 5, maxRange: 100, avgBody: 0.75, netBody: 0.25, bodyRatio: 0.38,
  wExp: 10, wEff: 10, wContract: 35, wShape: 35, wActivity: 10,
  maxTrendBars: 30, targetATR: 3, structureTolerance: 0.1,
  wDuration: 20, wDisplacement: 30, wEfficiency: 25, wStructure: 25,
  shapeWeight: 45, minShape: 35, lowThreshold: 50, highThreshold: 65,
} as const

export type BaselineDojiEvent = {
  time: number
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
  score: number
  tier: 'Low' | 'Moderate' | 'High'
  direction: -1 | 0 | 1
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const rank = (value: number, values: readonly number[]) =>
  100 * values.filter((item) => item <= value).length / values.length

export function detectBaselineDoji(bars: readonly LightweightCandle[]): BaselineDojiEvent[] {
  const { n, baseline, trendBars: L, atrPeriod } = CONFIG
  const bodies = bars.map((bar) => Math.abs(bar.close - bar.open))
  const ranges = bars.map((bar) => bar.high - bar.low)
  const trs = bars.map((bar, i) => {
    const previousClose = i ? bars[i - 1]!.close : bar.close
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose))
  })
  const events: BaselineDojiEvent[] = []
  const warmup = Math.max(n + baseline + 1, L + atrPeriod + 2, baseline + 1)
  for (let i = warmup; i < bars.length; i++) {
    const bar = bars[i]!
    const body = bodies[i]!
    const span = ranges[i]!
    if (!(span > 0)) continue
    const end = i - 1
    const net = bars[end]!.close - bars[end - n]!.close
    const displacement = Math.abs(net)
    let path = 0
    for (let j = end - n + 1; j <= end; j++) path += Math.abs(bars[j]!.close - bars[j - 1]!.close)
    const efficiency = path > 0 ? displacement / path : 0
    const history: number[] = []
    for (let j = end - n - baseline; j < end - n; j++) {
      if (j >= n) history.push(Math.abs(bars[j]!.close - bars[j - n]!.close))
    }
    const expansionPct = rank(displacement, history)
    const priorBody = mean(bodies.slice(i - n, i))
    const avgBody = priorBody > 0 ? body / priorBody : Infinity
    const netBody = displacement > 0 ? body / displacement : Infinity
    const bodyRatio = body / span
    const rangePct = rank(span, ranges.slice(i - baseline, i))
    const mid = (CONFIG.minRange + CONFIG.maxRange) / 2
    const half = Math.max(1, (CONFIG.maxRange - CONFIG.minRange) / 2)
    const shapeScore = CONFIG.wExp * expansionPct / 100 + CONFIG.wEff * efficiency +
      CONFIG.wContract * (clamp(1 - avgBody / (2 * CONFIG.avgBody)) + clamp(1 - netBody / (2 * CONFIG.netBody))) / 2 +
      CONFIG.wShape * clamp(1 - bodyRatio / (2 * CONFIG.bodyRatio)) +
      CONFIG.wActivity * clamp(1 - Math.abs(rangePct - mid) / (2 * half))

    const start = end - L
    const move = bars[end]!.close - bars[start]!.close
    const direction = Math.sign(move) as -1 | 0 | 1
    const trendDisplacement = Math.abs(move)
    const atr = mean(trs.slice(Math.max(1, end - atrPeriod + 1), end + 1))
    const dispATR = atr > 0 ? trendDisplacement / atr : 0
    let trendPath = 0
    for (let j = start + 1; j <= end; j++) trendPath += Math.abs(bars[j]!.close - bars[j - 1]!.close)
    const trendEfficiency = trendPath > 0 ? trendDisplacement / trendPath : 0
    let streak = 0
    for (let j = end; j > start; j--) {
      if (direction * (bars[j]!.close - bars[j - 1]!.close) < -CONFIG.structureTolerance * atr) break
      streak++
    }
    let progress = 0
    for (let j = start + 1; j <= end; j++) {
      const highProgress = direction * (bars[j]!.high - bars[j - 1]!.high) >= -CONFIG.structureTolerance * atr
      const lowProgress = direction * (bars[j]!.low - bars[j - 1]!.low) >= -CONFIG.structureTolerance * atr
      progress += (Number(highProgress) + Number(lowProgress)) / 2
    }
    const trendScore = CONFIG.wDuration * clamp(streak / CONFIG.maxTrendBars) +
      CONFIG.wDisplacement * clamp(dispATR / CONFIG.targetATR) +
      CONFIG.wEfficiency * trendEfficiency + CONFIG.wStructure * progress / L
    const score = (CONFIG.shapeWeight * shapeScore + (100 - CONFIG.shapeWeight) * trendScore) / 100
    const detected = bodyRatio <= CONFIG.bodyRatio && avgBody <= CONFIG.avgBody &&
      rangePct >= CONFIG.minRange && rangePct <= CONFIG.maxRange && shapeScore >= CONFIG.minShape
    if (!detected) continue
    const tier = score >= CONFIG.highThreshold ? 'High' : score >= CONFIG.lowThreshold ? 'Moderate' : 'Low'
    if (tier === 'High' || tier === 'Moderate') {
      events.push({
        time: bar.time,
        srcOpen: bar.open,
        srcHigh: bar.high,
        srcLow: bar.low,
        srcClose: bar.close,
        score,
        tier,
        direction,
      })
    }
  }
  return events
}
