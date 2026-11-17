export type PersistedChartViewport = {
  from: number
  to: number
  barSpacing: number
  rightOffset: number
}

const STORAGE_KEY = 'trading-dashboard.chart-viewports'

type ViewportStore = Record<string, PersistedChartViewport>

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseViewport(value: unknown): PersistedChartViewport | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<PersistedChartViewport>
  if (
    !isFiniteNumber(v.from) ||
    !isFiniteNumber(v.to) ||
    !isFiniteNumber(v.barSpacing) ||
    !isFiniteNumber(v.rightOffset)
  ) {
    return null
  }
  if (v.to <= v.from || v.barSpacing <= 0) return null
  return {
    from: v.from,
    to: v.to,
    barSpacing: v.barSpacing,
    rightOffset: v.rightOffset,
  }
}

function readStore(): ViewportStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const store: ViewportStore = {}
    for (const [tf, value] of Object.entries(parsed as Record<string, unknown>)) {
      const viewport = parseViewport(value)
      if (viewport) store[tf] = viewport
    }
    return store
  } catch {
    return {}
  }
}

function writeStore(store: ViewportStore): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota / private mode — ignore
  }
}

export function readViewport(timeframe: string): PersistedChartViewport | null {
  return readStore()[timeframe] ?? null
}

export function writeViewport(timeframe: string, viewport: PersistedChartViewport): void {
  const parsed = parseViewport(viewport)
  if (!parsed) return
  const store = readStore()
  store[timeframe] = parsed
  writeStore(store)
}
