import type { ChartType } from '../../_components/chart/price-chart'

export const SYMBOL = 'EURUSD'
export const CHART_TYPES = [
  { id: 'line', label: 'Line' },
  { id: 'candlestick', label: 'Candle' },
] as const satisfies readonly { id: ChartType; label: string }[]

export const PANES = [
  { id: '4h', label: '4h' },
  { id: '1h', label: '1h' },
  { id: '15m', label: '15m' },
  { id: '3m', label: '3m' },
] as const

export type PaneId = (typeof PANES)[number]['id']
export const FOCUS_PANE_IDS = ['15m', '3m'] as const satisfies readonly PaneId[]

export type PaneDefinition = (typeof PANES)[number]
export type WorkspaceLayoutMode = 'four' | 'focus' | 'expanded'

export function workspaceLayoutMode(expanded: PaneId | null, focusMode: boolean): WorkspaceLayoutMode {
  return expanded ? 'expanded' : focusMode ? 'focus' : 'four'
}

export function visibleWorkspacePanes(expanded: PaneId | null, focusMode: boolean): readonly PaneDefinition[] {
  if (expanded) return PANES.filter(pane => pane.id === expanded)
  return focusMode ? PANES.filter(pane => (FOCUS_PANE_IDS as readonly PaneId[]).includes(pane.id)) : PANES
}

/** Expansion is a presentation state, not a change to the mounted chart set. */
export function mountedWorkspacePanes(focusMode: boolean): readonly PaneDefinition[] {
  return visibleWorkspacePanes(null, focusMode)
}
