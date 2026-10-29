export const PRICE_FORMAT = { type: 'price' as const, precision: 5, minMove: 0.00001 }

export const VIEWPORT = {
  visibleBars: 256,
  maxVisibleBars: 1000,
  loadEdge: 50,
  /** Empty logical bars right of last candle for projection drawings. */
  futureLogicalBars: 24,
} as const

export const BOLLINGER = {
  length: 104,
  mult: 2,
  above: '#26a69a',
  below: '#ef5350',
  aboveFill: 'rgba(38, 166, 154, 0.35)',
  aboveFade: 'rgba(38, 166, 154, 0.02)',
  belowFill: 'rgba(239, 83, 80, 0.35)',
  belowFade: 'rgba(239, 83, 80, 0.02)',
  bandUpper: '#00897B',
  bandMiddle: '#00695C',
  bandLower: '#00897B',
} as const

export const SESSION_GRID = {
  line: '#0052FF',
} as const

export const CHART_THEME = {
  text: '#050F1A',
  grid: 'rgba(5, 15, 26, 0.06)',
  priceLine: '#050F1A',
  areaTop: 'rgba(5, 15, 26, 0.25)',
  areaBottom: 'rgba(5, 15, 26, 0.02)',
} as const

/** Bull = up close; bear = down close. Match app success/destructive. */
export const CANDLE = {
  up: '#05B169',
  down: '#DF2935',
  borderUp: '#05B169',
  borderDown: '#DF2935',
  wickUp: '#05B169',
  wickDown: '#DF2935',
} as const

/** Force marker — lifecycle by color; direction by hue. */
export const FORCE = {
  bullish: {
    fully: '#0891B2',
    partial: '#22D3EE',
    barely: '#A5F3FC',
  },
  bearish: {
    fully: '#C026D3',
    partial: '#E879F9',
    barely: '#F5D0FE',
  },
} as const

/** Engulfing marker — distinct from force cyan/magenta. */
export const ENGULFING = {
  bullish: '#F59E0B',
  bearish: '#4F46E5',
} as const
