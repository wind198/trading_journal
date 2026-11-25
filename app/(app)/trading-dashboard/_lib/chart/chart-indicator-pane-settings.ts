import {
  defaultSessionSlotEnabled,
  defaultSessionOpenTimes,
  normalizeSessionOpenTimes,
  type SessionOpenTimes,
  type SessionSlotId,
} from './chart-timezone'
import type { Regime } from '../overlays/baseline-indicators'

export const DASHBOARD_PANE_IDS = ['4h', '1h', '15m', '3m'] as const
export type DashboardPaneId = (typeof DASHBOARD_PANE_IDS)[number]

export type PaneIndicatorToggles = {
  bollinger: boolean
  ichimoku: boolean
  regime: boolean
  force: boolean
  engulfing: boolean
  doji: boolean
  doublePattern: boolean
  keyLevels: boolean
}

export type ChartOverlaySettings = {
  volumeProfile: boolean
  autoIndicatorsByRegime: boolean
  sessionSlots: Record<SessionSlotId, boolean>
  sessionOpenTimes: SessionOpenTimes
  indicatorsByPane: Record<DashboardPaneId, PaneIndicatorToggles>
}

const PANE_DEFAULTS: PaneIndicatorToggles = {
  bollinger: true,
  ichimoku: false,
  regime: true,
  force: true,
  engulfing: true,
  doji: true,
  doublePattern: false,
  keyLevels: true,
}

export function defaultPaneIndicatorToggles(): PaneIndicatorToggles {
  return { ...PANE_DEFAULTS }
}

export function defaultIndicatorsByPane(): Record<DashboardPaneId, PaneIndicatorToggles> {
  const defaults = {
    '4h': defaultPaneIndicatorToggles(),
    '1h': defaultPaneIndicatorToggles(),
    '15m': defaultPaneIndicatorToggles(),
    '3m': defaultPaneIndicatorToggles(),
  }
  defaults['4h'].regime = false
  defaults['1h'].regime = false
  return defaults
}

export const DEFAULT_OVERLAY_SETTINGS: ChartOverlaySettings = {
  volumeProfile: true,
  autoIndicatorsByRegime: false,
  sessionSlots: defaultSessionSlotEnabled(),
  sessionOpenTimes: defaultSessionOpenTimes(),
  indicatorsByPane: defaultIndicatorsByPane(),
}

export function isDashboardPaneId(value: unknown): value is DashboardPaneId {
  return (
    typeof value === 'string' &&
    (DASHBOARD_PANE_IDS as readonly string[]).includes(value)
  )
}

function parseIndicatorsByPane(
  parsed: Record<string, unknown>,
): Record<DashboardPaneId, PaneIndicatorToggles> {
  const out = defaultIndicatorsByPane()

  const legacyBollinger =
    typeof parsed.bollinger === 'boolean' ? parsed.bollinger : undefined
  const legacyIchimoku =
    typeof parsed.ichimoku === 'boolean' ? parsed.ichimoku : undefined

  if (legacyBollinger !== undefined || legacyIchimoku !== undefined) {
    for (const id of DASHBOARD_PANE_IDS) {
      if (legacyBollinger !== undefined) out[id].bollinger = legacyBollinger
      if (legacyIchimoku !== undefined) out[id].ichimoku = legacyIchimoku
    }
    return out
  }

  const raw = parsed.indicatorsByPane
  if (!raw || typeof raw !== 'object') return out

  for (const id of DASHBOARD_PANE_IDS) {
    const entry = (raw as Record<string, unknown>)[id]
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    if (typeof row.bollinger === 'boolean') out[id].bollinger = row.bollinger
    if (typeof row.ichimoku === 'boolean') out[id].ichimoku = row.ichimoku
    if (typeof row.regime === 'boolean') out[id].regime = row.regime
    if (typeof row.force === 'boolean') out[id].force = row.force
    if (typeof row.engulfing === 'boolean') out[id].engulfing = row.engulfing
    if (typeof row.doji === 'boolean') out[id].doji = row.doji
    if (typeof row.doublePattern === 'boolean') out[id].doublePattern = row.doublePattern
    if (typeof row.keyLevels === 'boolean') out[id].keyLevels = row.keyLevels
  }

  return out
}

export function parseChartOverlaySettings(raw: string): ChartOverlaySettings {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const defaults = defaultSessionSlotEnabled()
    const slots = { ...defaults }
    const sessionSlots = parsed.sessionSlots
    if (sessionSlots && typeof sessionSlots === 'object') {
      for (const id of Object.keys(defaults) as SessionSlotId[]) {
        const legacy: Partial<Record<SessionSlotId, string>> = { tokyo: '07:00', london: '14:00', newyork: '19:30' }
        const old = sessionSlots as Record<string, unknown>
        const value = old[id] ?? (legacy[id] ? old[legacy[id]!] : undefined)
        if (typeof value === 'boolean') slots[id] = value
      }
    }
    return {
      volumeProfile:
        typeof parsed.volumeProfile === 'boolean'
          ? parsed.volumeProfile
          : DEFAULT_OVERLAY_SETTINGS.volumeProfile,
      autoIndicatorsByRegime: parsed.autoIndicatorsByRegime === true,
      sessionSlots: slots,
      sessionOpenTimes: normalizeSessionOpenTimes(parsed.sessionOpenTimes),
      indicatorsByPane: parseIndicatorsByPane(parsed),
    }
  } catch {
    return DEFAULT_OVERLAY_SETTINGS
  }
}

export function regimeIndicatorVisibility(
  auto: boolean,
  regime: Regime | null,
  manual: Pick<PaneIndicatorToggles, 'bollinger' | 'ichimoku'>,
): Pick<PaneIndicatorToggles, 'bollinger' | 'ichimoku'> {
  if (!auto) return { bollinger: manual.bollinger, ichimoku: manual.ichimoku }
  return {
    bollinger: regime === 'CHOPPY',
    ichimoku: regime === 'UP' || regime === 'DOWN',
  }
}

export function setIndicatorAllPanes(
  settings: ChartOverlaySettings,
  key: keyof PaneIndicatorToggles,
  on: boolean,
): ChartOverlaySettings {
  const indicatorsByPane = { ...settings.indicatorsByPane }
  for (const id of DASHBOARD_PANE_IDS) {
    indicatorsByPane[id] = { ...indicatorsByPane[id], [key]: on }
  }
  return { ...settings, indicatorsByPane }
}

export function paneIndicators(
  settings: ChartOverlaySettings,
  paneId: string,
): PaneIndicatorToggles {
  if (isDashboardPaneId(paneId)) {
    return {
      ...settings.indicatorsByPane[paneId],
      regime:
        (paneId === '15m' || paneId === '3m') &&
        settings.indicatorsByPane[paneId].regime,
    }
  }
  return defaultPaneIndicatorToggles()
}

export function setPaneIndicator(
  settings: ChartOverlaySettings,
  paneId: DashboardPaneId,
  key: keyof PaneIndicatorToggles,
  on: boolean,
): ChartOverlaySettings {
  return {
    ...settings,
    indicatorsByPane: {
      ...settings.indicatorsByPane,
      [paneId]: { ...settings.indicatorsByPane[paneId], [key]: on },
    },
  }
}
