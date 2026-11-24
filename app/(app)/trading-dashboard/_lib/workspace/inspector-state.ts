export type InspectorTab = 'market' | 'notes' | 'indicators' | 'alerts' | 'guides'
export type InspectorState = { open: boolean; tab: InspectorTab }
export const DEFAULT_INSPECTOR: InspectorState = { open: false, tab: 'notes' }
export function toggleInspector(current: InspectorState): InspectorState {
  return { ...current, open: !current.open }
}
export function showInspector(current: InspectorState, tab: InspectorTab): InspectorState {
  return { ...current, open: true, tab }
}
