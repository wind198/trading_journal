import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { before, test } from 'node:test'
import {
  CANDLE_TIMEFRAMES,
  HISTORY_CANDLE_LIMIT,
  ticksToCandles,
  type CandleTimeframe,
  type LightweightCandle,
  type TickRow,
} from './candles'

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

let fetchTicks: (options: { symbol: string; limit?: number }) => Promise<TickRow[]>
let fetchHistoricalCandles: (options: {
  symbol: string
  timeframe: CandleTimeframe
  before?: number
  limit?: number
}) => Promise<LightweightCandle[]>
let fetchRecentCandles: (options: {
  symbol: string
  timeframe: CandleTimeframe
  limit?: number
}) => Promise<LightweightCandle[]>

before(async () => {
  const mod = await import('./fetch')
  fetchTicks = mod.fetchTicks
  fetchHistoricalCandles = mod.fetchHistoricalCandles
  fetchRecentCandles = mod.fetchRecentCandles
})

function assertOhlc(bars: LightweightCandle[], label: string) {
  assert.ok(bars.length > 0, `${label} returned no bars`)
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]
    assert.equal(bar.time, Math.floor(bar.time))
    assert.ok(bar.time < 1e11, `${label} time must be Unix seconds`)
    assert.ok(bar.high >= bar.open && bar.high >= bar.close && bar.high >= bar.low)
    assert.ok(bar.low <= bar.open && bar.low <= bar.close && bar.low > 0)
    if (i > 0) assert.ok(bar.time > bars[i - 1].time)
  }
}

test('fetches EURUSD ticks from Supabase and builds Lightweight Charts candles', async () => {
  const ticks = await fetchTicks({ symbol: 'EURUSD', limit: 1000 })
  assert.ok(ticks.length > 1, 'expected EURUSD ticks')

  for (let i = 1; i < ticks.length; i++) {
    assert.ok(ticks[i].time_msc >= ticks[i - 1].time_msc)
  }

  const candles: LightweightCandle[] = ticksToCandles(ticks, 60)
  assert.ok(candles.length > 0)

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i]
    assert.equal(bar.time, Math.floor(bar.time))
    assert.ok(bar.time < 1e11, 'time must be Unix seconds')
    assert.ok(bar.high >= bar.open && bar.high >= bar.close && bar.high >= bar.low)
    assert.ok(bar.low <= bar.open && bar.low <= bar.close && bar.low > 0)
    if (i > 0) assert.ok(bar.time > candles[i - 1].time)
  }
})

test('unknown symbol returns no ticks', async () => {
  const ticks = await fetchTicks({ symbol: 'NO_SUCH_SYMBOL_ZZ', limit: 10 })
  assert.deepEqual(ticks, [])
  assert.deepEqual(ticksToCandles(ticks, 60), [])
})

test('reads one EURUSD candle page and an older page before that cursor', async () => {
  for (const timeframe of Object.keys(CANDLE_TIMEFRAMES) as CandleTimeframe[]) {
    let bars: LightweightCandle[]
    try {
      bars = await fetchHistoricalCandles({
        symbol: 'EURUSD',
        timeframe,
        limit: HISTORY_CANDLE_LIMIT,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed'
      throw new Error(`${timeframe}: ${message}`)
    }
    assertOhlc(bars, timeframe)
    assert.ok(bars.length <= HISTORY_CANDLE_LIMIT, `${timeframe} returned ${bars.length}`)
    if (timeframe !== '5m') continue

    assert.equal(bars.length, HISTORY_CANDLE_LIMIT)
    const older = await fetchHistoricalCandles({
      symbol: 'EURUSD',
      timeframe,
      before: bars[0].time,
      limit: HISTORY_CANDLE_LIMIT,
    })
    assertOhlc(older, '5m before')
    assert.ok(older.length <= HISTORY_CANDLE_LIMIT)
    assert.ok(older[older.length - 1].time < bars[0].time)
  }
})

test('reads at most 10 recent EURUSD candles per timeframe', async () => {
  for (const timeframe of Object.keys(CANDLE_TIMEFRAMES) as CandleTimeframe[]) {
    let bars: LightweightCandle[]
    try {
      bars = await fetchRecentCandles({ symbol: 'EURUSD', timeframe, limit: 10 })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed'
      throw new Error(`${timeframe}: ${message}`)
    }
    assertOhlc(bars, timeframe)
    assert.ok(bars.length <= 10, `${timeframe} returned ${bars.length}`)
  }
})
