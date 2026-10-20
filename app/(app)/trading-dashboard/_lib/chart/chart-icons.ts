import { CANDLE } from './price-chart-style'

export type ChartIconFamily =
  | 'strong_push'
  | 'weakening_trend'
  | 'weak_reaction'
  | 'resistance_test'

export type ChartIconDirection = 'up' | 'down'

/** Persisted `kind` values (includes legacy single-direction ids). */
export const CHART_ICON_KINDS = [
  'icon_strong_push_up',
  'icon_strong_push_down',
  'icon_weakening_trend_up',
  'icon_weakening_trend_down',
  'icon_weak_reaction_up',
  'icon_weak_reaction_down',
  'icon_resistance_test_up',
  'icon_resistance_test_down',
  'icon_strong_push',
  'icon_weakening_trend',
  'icon_weak_reaction',
  'icon_resistance_test',
] as const

export type ChartIconKind = (typeof CHART_ICON_KINDS)[number]

export type ChartIconDefinition = {
  kind: ChartIconKind
  label: string
  description: string
  family: ChartIconFamily
  direction: ChartIconDirection
}

export const CHART_ICON_DEFINITIONS: ChartIconDefinition[] = [
  {
    kind: 'icon_strong_push_up',
    label: 'Strong push ↑',
    description: 'Strong bullish push',
    family: 'strong_push',
    direction: 'up',
  },
  {
    kind: 'icon_strong_push_down',
    label: 'Strong push ↓',
    description: 'Strong bearish push',
    family: 'strong_push',
    direction: 'down',
  },
  {
    kind: 'icon_weakening_trend_up',
    label: 'Weakening trend ↑',
    description: 'Uptrend losing momentum',
    family: 'weakening_trend',
    direction: 'up',
  },
  {
    kind: 'icon_weakening_trend_down',
    label: 'Weakening trend ↓',
    description: 'Downtrend losing momentum',
    family: 'weakening_trend',
    direction: 'down',
  },
  {
    kind: 'icon_weak_reaction_up',
    label: 'Weak reaction ↑',
    description: 'Muted bullish reaction',
    family: 'weak_reaction',
    direction: 'up',
  },
  {
    kind: 'icon_weak_reaction_down',
    label: 'Weak reaction ↓',
    description: 'Muted bearish reaction',
    family: 'weak_reaction',
    direction: 'down',
  },
  {
    kind: 'icon_resistance_test_up',
    label: 'Resistance test ↑',
    description: 'Test of resistance from below',
    family: 'resistance_test',
    direction: 'up',
  },
  {
    kind: 'icon_resistance_test_down',
    label: 'Support test ↓',
    description: 'Test of support from above',
    family: 'resistance_test',
    direction: 'down',
  },
]

const LEGACY_ICON_DIRECTION: Partial<Record<ChartIconKind, ChartIconDirection>> = {
  icon_strong_push: 'up',
  icon_weakening_trend: 'up',
  icon_weak_reaction: 'up',
  icon_resistance_test: 'up',
}

export function isChartIconKind(kind: string): kind is ChartIconKind {
  return (CHART_ICON_KINDS as readonly string[]).includes(kind)
}

export function resolveChartIconVariant(kind: ChartIconKind): {
  family: ChartIconFamily
  direction: ChartIconDirection
  color: string
} {
  const def = CHART_ICON_DEFINITIONS.find((item) => item.kind === kind)
  if (def) {
    return {
      family: def.family,
      direction: def.direction,
      color: def.direction === 'up' ? CANDLE.up : CANDLE.down,
    }
  }

  const legacyDirection = LEGACY_ICON_DIRECTION[kind] ?? 'up'
  const family = kind.replace(/^icon_/, '') as ChartIconFamily
  return {
    family,
    direction: legacyDirection,
    color: legacyDirection === 'up' ? CANDLE.up : CANDLE.down,
  }
}
