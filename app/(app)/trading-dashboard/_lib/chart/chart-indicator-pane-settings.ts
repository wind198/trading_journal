import {
  defaultSessionSlotEnabled,
  type SessionSlotId,
} from './chart-timezone'

export const DASHBOARD_PANE_IDS = ['4h', '1h', '15m', '3m'] as const
export type DashboardPaneId = (typeof DASHBOARD_PANE_IDS)[number]

export type PaneIndicatorToggles = { bollinger: boolean; ichimoku: boolean }

export type ChartOverlaySettings = {
  volumeProfile: boolean
  sessionSlots: Record<SessionSlotId, boolean>
  indicatorsByPane: Record<DashboardPaneId, PaneIndicatorToggles>
}

const PANE_DEFAULTS: PaneIndicatorToggles = { bollinger: true, ichimoku: false }

export function defaultPaneIndicatorToggles(): PaneIndicatorToggles {
  return { ...PANE_DEFAULTS }
}

export function defaultIndicatorsByPane(): Record<DashboardPaneId, PaneIndicatorToggles> {
  return {
    '4h': defaultPaneIndicatorToggles(),
    '1h': defaultPaneIndicatorToggles(),
    '15m': defaultPaneIndicatorToggles(),
    '3m': defaultPaneIndicatorToggles(),
  }
}

export const DEFAULT_OVERLAY_SETTINGS: ChartOverlaySettings = {
  volumeProfile: true,
  sessionSlots: defaultSessionSlotEnabled(),
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
        const value = (sessionSlots as Record<string, unknown>)[id]
        if (typeof value === 'boolean') slots[id] = value
      }
    }
    return {
      volumeProfile:
        typeof parsed.volumeProfile === 'boolean'
          ? parsed.volumeProfile
          : DEFAULT_OVERLAY_SETTINGS.volumeProfile,
      sessionSlots: slots,
      indicatorsByPane: parseIndicatorsByPane(parsed),
    }
  } catch {
    return DEFAULT_OVERLAY_SETTINGS
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
      bollinger: settings.indicatorsByPane[paneId].bollinger,
      ichimoku: settings.indicatorsByPane[paneId].ichimoku,
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