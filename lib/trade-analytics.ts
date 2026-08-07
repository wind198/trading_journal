import { BuyOrSell, OrderType, TradeEntry } from '@/lib/types'
import { formatVnDate, toVnDateKey } from '@/lib/date-range'

export type SegmentKey =
  | 'BUY_EXTREME'
  | 'BUY_TREND_FOLLOWING'
  | 'SELL_EXTREME'
  | 'SELL_TREND_FOLLOWING'

export type SegmentStats = {
  key: SegmentKey
  label: string
  shortLabel: string
  direction: BuyOrSell
  orderType: OrderType
  total: number
  wins: number
  losses: number
  pending: number
  completed: number
  sharePct: number
  winRatePct: number | null
}

export type DailyOutcome = {
  dateKey: string
  label: string
  wins: number
  losses: number
  pending: number
  total: number
}

export type TradeAnalytics = {
  total: number
  wins: number
  losses: number
  pending: number
  completed: number
  winRatePct: number | null
  segments: SegmentStats[]
  daily: DailyOutcome[]
  insights: string[]
}

const SEGMENT_DEFS: Omit<
  SegmentStats,
  'total' | 'wins' | 'losses' | 'pending' | 'completed' | 'sharePct' | 'winRatePct'
>[] = [
  {
    key: 'BUY_EXTREME',
    label: 'Buy Extreme',
    shortLabel: 'Buy EX',
    direction: 'BUY',
    orderType: 'EXTREME',
  },
  {
    key: 'BUY_TREND_FOLLOWING',
    label: 'Buy Trend following',
    shortLabel: 'Buy TF',
    direction: 'BUY',
    orderType: 'TREND_FOLLOWING',
  },
  {
    key: 'SELL_EXTREME',
    label: 'Sell Extreme',
    shortLabel: 'Sell EX',
    direction: 'SELL',
    orderType: 'EXTREME',
  },
  {
    key: 'SELL_TREND_FOLLOWING',
    label: 'Sell Trend following',
    shortLabel: 'Sell TF',
    direction: 'SELL',
    orderType: 'TREND_FOLLOWING',
  },
]

const MIN_SEGMENT_SAMPLE = 3

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export function computeTradeAnalytics(trades: TradeEntry[]): TradeAnalytics {
  const wins = trades.filter((t) => t.win === true).length
  const losses = trades.filter((t) => t.win === false).length
  const pending = trades.filter((t) => t.win === null).length
  const completed = wins + losses
  const total = trades.length

  const segments: SegmentStats[] = SEGMENT_DEFS.map((def) => {
    const items = trades.filter(
      (t) => t.buy_or_sell === def.direction && t.order_type === def.orderType
    )
    const segWins = items.filter((t) => t.win === true).length
    const segLosses = items.filter((t) => t.win === false).length
    const segPending = items.filter((t) => t.win === null).length
    const segCompleted = segWins + segLosses
    return {
      ...def,
      total: items.length,
      wins: segWins,
      losses: segLosses,
      pending: segPending,
      completed: segCompleted,
      sharePct: total > 0 ? Math.round((items.length / total) * 1000) / 10 : 0,
      winRatePct: pct(segWins, segCompleted),
    }
  })

  const dayMap = new Map<string, DailyOutcome>()
  for (const trade of trades) {
    const dateKey = toVnDateKey(trade.created_at)
    let day = dayMap.get(dateKey)
    if (!day) {
      day = {
        dateKey,
        label: formatVnDate(dateKey),
        wins: 0,
        losses: 0,
        pending: 0,
        total: 0,
      }
      dayMap.set(dateKey, day)
    }
    day.total += 1
    if (trade.win === true) day.wins += 1
    else if (trade.win === false) day.losses += 1
    else day.pending += 1
  }

  const daily = [...dayMap.values()].sort((a, b) =>
    a.dateKey < b.dateKey ? -1 : 1
  )

  const insights = buildInsights({
    total,
    wins,
    losses,
    pending,
    completed,
    winRatePct: pct(wins, completed),
    segments,
  })

  return {
    total,
    wins,
    losses,
    pending,
    completed,
    winRatePct: pct(wins, completed),
    segments,
    daily,
    insights,
  }
}

function buildInsights(input: {
  total: number
  wins: number
  losses: number
  pending: number
  completed: number
  winRatePct: number | null
  segments: SegmentStats[]
}): string[] {
  const { total, pending, completed, winRatePct, segments } = input
  if (total === 0) return ['No trades in this range.']

  const insights: string[] = []

  const dominant = [...segments].sort((a, b) => b.total - a.total)[0]
  if (dominant && dominant.total > 0) {
    insights.push(
      `Most used: ${dominant.shortLabel} (${dominant.total}, ${dominant.sharePct}%).`
    )
  }

  if (completed === 0) {
    insights.push(
      pending > 0
        ? `${pending} pending — mark outcomes to unlock win rate.`
        : 'No completed trades yet.'
    )
    return insights
  }

  if (winRatePct !== null) {
    insights.push(`Win rate ${winRatePct}% on ${completed} completed.`)
  }

  const ranked = segments
    .filter((s) => s.completed >= MIN_SEGMENT_SAMPLE && s.winRatePct !== null)
    .sort((a, b) => (b.winRatePct ?? 0) - (a.winRatePct ?? 0))

  if (ranked.length >= 2) {
    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    insights.push(
      `Best: ${best.shortLabel} (${best.winRatePct}% / ${best.completed}).`
    )
    if (worst.key !== best.key) {
      insights.push(
        `Weakest: ${worst.shortLabel} (${worst.winRatePct}% / ${worst.completed}).`
      )
    }
  } else if (ranked.length === 1) {
    insights.push(
      `Only ${ranked[0].shortLabel} has ≥${MIN_SEGMENT_SAMPLE} completed samples.`
    )
  } else {
    insights.push(
      `Need ≥${MIN_SEGMENT_SAMPLE} completed per setup to rank performance.`
    )
  }

  return insights
}
