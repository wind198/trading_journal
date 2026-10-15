import type { LightweightCandle } from './ticks/candles'
import {
  calculateForceSignals,
  DEFAULT_FORCE_CANDLE_CONFIG,
  type ForceCandleConfig,
} from './force-candles'

export const ForceStatus = {
  FullyActive: 'FULLY_ACTIVE',
  PartiallyActive: 'PARTIALLY_ACTIVE',
  BarelyActive: 'BARELY_ACTIVE',
  Inactive: 'INACTIVE',
} as const
export type ForceStatus = (typeof ForceStatus)[keyof typeof ForceStatus]

export const ForceDirection = {
  Bullish: 'BULLISH',
  Bearish: 'BEARISH',
} as const
export type ForceDirection = (typeof ForceDirection)[keyof typeof ForceDirection]

export type ForceEvent = {
  eventId: number
  barIndex: number
  time: number
  direction: ForceDirection
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
  bodySize: number
  bodyCorrection: number
  status: ForceStatus
  strength: number
}

export type ForceDecayConfig = ForceCandleConfig & {
  barelyActiveCorrection: number
}

export const DEFAULT_FORCE_DECAY_CONFIG: ForceDecayConfig = {
  ...DEFAULT_FORCE_CANDLE_CONFIG,
  barelyActiveCorrection: 0.4,
}

export function calculateBodyCorrection(
  srcClose: number,
  forceOpen: number,
  forceClose: number,
  bullishForce: boolean,
): number {
  const forceBody = Math.abs(forceClose - forceOpen)
  if (forceBody <= 0) return 0
  if (bullishForce) {
    const bodyTop = Math.max(forceOpen, forceClose)
    const penetration = bodyTop - srcClose
    return Math.max(0, Math.min(1, penetration / forceBody))
  }
  const bodyBottom = Math.min(forceOpen, forceClose)
  const penetration = srcClose - bodyBottom
  return Math.max(0, Math.min(1, penetration / forceBody))
}

export function advanceForceStatus(
  currentStatus: ForceStatus,
  bodyCorrection: number,
  barelyActiveCorrection: number,
): ForceStatus {
  if (currentStatus === ForceStatus.Inactive) return ForceStatus.Inactive
  if (bodyCorrection >= barelyActiveCorrection) {
    if (currentStatus === ForceStatus.FullyActive) return ForceStatus.PartiallyActive
    return ForceStatus.BarelyActive
  }
  return currentStatus
}

function calculateStrength(bodyCorrection: number, previousStrength: number): number {
  const correctionFactor = 1 - bodyCorrection
  const raw = 100 * correctionFactor
  return Math.min(previousStrength, raw)
}

function getBackExtremes(
  bars: readonly LightweightCandle[],
  index: number,
): { backHigh: number | null; backLow: number | null } {
  if (index < 1) return { backHigh: null, backLow: null }
  const h1 = bars[index - 1]!.high
  const l1 = bars[index - 1]!.low
  if (index < 2) return { backHigh: h1, backLow: l1 }
  return {
    backHigh: Math.max(h1, bars[index - 2]!.high),
    backLow: Math.min(l1, bars[index - 2]!.low),
  }
}

function applyBirthBackCorrection(
  event: ForceEvent,
  backHigh: number | null,
  backLow: number | null,
  barelyActiveCorrection: number,
): void {
  if (event.direction === ForceDirection.Bullish && backLow != null) {
    event.bodyCorrection = calculateBodyCorrection(
      backLow,
      event.srcOpen,
      event.srcClose,
      true,
    )
    event.status = advanceForceStatus(
      ForceStatus.FullyActive,
      event.bodyCorrection,
      barelyActiveCorrection,
    )
    event.strength = calculateStrength(event.bodyCorrection, 100)
  } else if (event.direction === ForceDirection.Bearish && backHigh != null) {
    event.bodyCorrection = calculateBodyCorrection(
      backHigh,
      event.srcOpen,
      event.srcClose,
      false,
    )
    event.status = advanceForceStatus(
      ForceStatus.FullyActive,
      event.bodyCorrection,
      barelyActiveCorrection,
    )
    event.strength = calculateStrength(event.bodyCorrection, 100)
  }
}

function updateEvent(
  event: ForceEvent,
  currentClose: number,
  barelyActiveCorrection: number,
): void {
  event.bodyCorrection = calculateBodyCorrection(
    currentClose,
    event.srcOpen,
    event.srcClose,
    event.direction === ForceDirection.Bullish,
  )
  event.status = advanceForceStatus(event.status, event.bodyCorrection, barelyActiveCorrection)
  event.strength = calculateStrength(event.bodyCorrection, event.strength)
}

export type ForceDecayResult = {
  /** Non-inactive events at series end (latest status). */
  activeEvents: ForceEvent[]
  completedEvents: ForceEvent[]
}

/** Run ForceCandleWithDecay over a full OHLC series (oldest → newest). */
export function calculateForceDecay(
  bars: readonly LightweightCandle[],
  config: ForceDecayConfig = DEFAULT_FORCE_DECAY_CONFIG,
): ForceDecayResult {
  const activeEvents: ForceEvent[] = []
  const completedEvents: ForceEvent[] = []
  let nextEventId = 1
  const ranges: number[] = []

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!
    const priorClose = i > 0 ? bars[i - 1]!.close : null
    const effectiveOpen = priorClose ?? bar.open
    const effectiveHigh = Math.max(bar.high, effectiveOpen)
    const effectiveLow = Math.min(bar.low, effectiveOpen)
    const candleRange = effectiveHigh - effectiveLow

    const lookbackRanges =
      ranges.length >= config.lookback
        ? ranges.slice(ranges.length - (config.lookback - 1))
        : ranges.slice()
    // calculateForceSignals appends current range; pass prior window only
    const { bullishForce, bearishForce } = calculateForceSignals(
      effectiveHigh,
      effectiveLow,
      effectiveOpen,
      bar.close,
      lookbackRanges,
      config,
    )
    ranges.push(candleRange)

    const { backHigh, backLow } = getBackExtremes(bars, i)

    if (bullishForce) {
      const event: ForceEvent = {
        eventId: nextEventId++,
        barIndex: i,
        time: bar.time,
        direction: ForceDirection.Bullish,
        srcOpen: effectiveOpen,
        srcHigh: effectiveHigh,
        srcLow: effectiveLow,
        srcClose: bar.close,
        bodySize: Math.abs(bar.close - effectiveOpen),
        bodyCorrection: 0,
        status: ForceStatus.FullyActive,
        strength: 100,
      }
      applyBirthBackCorrection(event, backHigh, backLow, config.barelyActiveCorrection)
      activeEvents.push(event)
    }

    if (bearishForce) {
      const event: ForceEvent = {
        eventId: nextEventId++,
        barIndex: i,
        time: bar.time,
        direction: ForceDirection.Bearish,
        srcOpen: effectiveOpen,
        srcHigh: effectiveHigh,
        srcLow: effectiveLow,
        srcClose: bar.close,
        bodySize: Math.abs(bar.close - effectiveOpen),
        bodyCorrection: 0,
        status: ForceStatus.FullyActive,
        strength: 100,
      }
      applyBirthBackCorrection(event, backHigh, backLow, config.barelyActiveCorrection)
      activeEvents.push(event)
    }

    const nextActive: ForceEvent[] = []
    for (const event of activeEvents) {
      if (event.barIndex < i) {
        updateEvent(event, bar.close, config.barelyActiveCorrection)
      }
      if (event.status === ForceStatus.Inactive) {
        completedEvents.push(event)
      } else {
        nextActive.push(event)
      }
    }
    activeEvents.length = 0
    activeEvents.push(...nextActive)
  }

  return { activeEvents: [...activeEvents], completedEvents }
}

/**
 * Display filter: keep calculating all events, but only show the first force
 * candle in each consecutive bar streak (same bar extras also hidden).
 */
export function filterConsecutiveForceDisplay(
  events: readonly ForceEvent[],
): ForceEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.barIndex - b.barIndex || a.eventId - b.eventId,
  )
  const shown: ForceEvent[] = []
  let lastForceBar = Number.NEGATIVE_INFINITY
  for (const event of sorted) {
    if (event.barIndex === lastForceBar || event.barIndex === lastForceBar + 1) {
      if (event.barIndex === lastForceBar + 1) lastForceBar = event.barIndex
      continue
    }
    shown.push(event)
    lastForceBar = event.barIndex
  }
  return shown
}
