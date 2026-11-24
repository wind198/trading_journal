import type { ChartDrawingKind } from '../chart/chart-drawings'
import type { PaneId } from './workspace-layout'

export type DrawingMode = { kind: 'idle' } | { kind: 'measure' } | { kind: 'draw'; tool: ChartDrawingKind }
export type DrawingControl = { paneId: PaneId; mode: DrawingMode }
export const IDLE_MODE: DrawingMode = { kind: 'idle' }

export function activatePane(current: DrawingControl, paneId: PaneId): DrawingControl {
  return current.paneId === paneId ? current : { paneId, mode: IDLE_MODE }
}

export function resolveDrawingControl(current: DrawingControl, visible: readonly PaneId[]): DrawingControl {
  return visible.includes(current.paneId) || !visible.length ? current : activatePane(current, visible[0]!)
}

export function toggleDrawingMode(current: DrawingControl, mode: DrawingMode): DrawingControl {
  const same = current.mode.kind === mode.kind &&
    (mode.kind !== 'draw' || (current.mode.kind === 'draw' && current.mode.tool === mode.tool))
  return { ...current, mode: same ? IDLE_MODE : mode }
}

export function cancelPaneMode(current: DrawingControl, paneId: PaneId, kind: DrawingMode['kind']): DrawingControl {
  return current.paneId === paneId && current.mode.kind === kind ? { ...current, mode: IDLE_MODE } : current
}
