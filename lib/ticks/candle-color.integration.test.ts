import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { before, test } from 'node:test'
import { BOLLINGER } from '../price-chart-style'
import { bollinger, outsideColor, pricePoint } from '../price-chart-series'
import { HISTORY_CANDLE_LIMIT, type LightweightCandle } from './candles'

function loadEnv() {
  const text = readFileSync(new URL('../../.env', import.meta.url), 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const i = trimmed.indexOf('=')
    const key = trimmed.slice(0, i)
    const value = trimmed.slice(i + 1).replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const WINDOW_START = Math.floor(Date.parse('2026-10-14T12:30:00Z') / 1000)
const WINDOW_END = Math.floor(Date.parse('2026-10-14T13:00:00Z') / 1000)

let fetchHistoricalCandles: (options: {
  symbol: string
  timeframe: '3m'
  before?: number
  limit?: number
}) => Promise<LightweightCandle[]>

before(async () => {
  const mod = await import('./fetch')
  fetchHistoricalCandles = mod.fetchHistoricalCandles
})

test('3m candlestick points keep bull/bear (no BB override) for 14 Oct 12:30–13:00 UTC', async () => {
  const bars = await fetchHistoricalCandles({
    symbol: 'EURUSD',
    timeframe: '3m',
    before: WINDOW_END,
    limit: HISTORY_CANDLE_LIMIT,
  })
  assert.ok(bars.length >= BOLLINGER.length, `need ≥${BOLLINGER.length} bars for BB warm-up`)

  const { levels } = bollinger(bars)
  const windowIndexes = bars
    .map((bar, index) => ({ bar, index }))
    .filter(({ bar }) => bar.time >= WINDOW_START && bar.time < WINDOW_END)

  assert.ok(windowIndexes.length > 0, 'expected 3m bars in 12:30–13:00 UTC window')

  for (const { bar, index } of windowIndexes) {
    const level = levels[index]
    const candlePoint = pricePoint(bar, level, 'candlestick') as {
      color?: string
      borderColor?: string
      wickColor?: string
    }
    assert.equal(candlePoint.color, undefined, `candlestick color at ${bar.time}`)
    assert.equal(candlePoint.borderColor, undefined, `candlestick border at ${bar.time}`)
    assert.equal(candlePoint.wickColor, undefined, `candlestick wick at ${bar.time}`)

    const linePoint = pricePoint(bar, level, 'line') as { color?: string; value: number }
    const expected = outsideColor(bar.close, level)
    if (expected == null) {
      assert.equal(linePoint.color, undefined, `line color at ${bar.time}`)
    } else {
      assert.equal(linePoint.color, expected, `line band color at ${bar.time}`)
      assert.ok(
        expected === BOLLINGER.above || expected === BOLLINGER.below,
        `unexpected band color ${expected}`,
      )
    }
  }
})
