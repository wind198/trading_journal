import type { ChartHandle } from '../../price-chart-handle'
import { DrawingSelectionSession } from './drawing-selection-session'

export type ChartSelectionRuntimePorts = {
  handle: ChartHandle
  syncHitGeometry: () => void
  select: (id: string | null) => void
  editLabel: (id: string) => void
}

/** Owns selection/label-edit gesture session. */
export function createChartSelectionRuntime(
  ports: ChartSelectionRuntimePorts,
  gesture: { doubleTapMs: number; doubleTapPx: number; tapThresholdPx?: number },
) {
  const session = new DrawingSelectionSession(
    ports,
    gesture.doubleTapMs,
    gesture.doubleTapPx,
    gesture.tapThresholdPx,
  )

  return {
    get activePointerId() {
      return session.activePointerId
    },
    pointerDown: (event: PointerEvent) => session.pointerDown(event),
    pointerUp: (event: PointerEvent) => session.pointerUp(event),
    cancelPointer: () => session.cancelPointer(),
    markDrag: () => session.markDrag(),
    suppressNextClick: () => session.suppressNextClick(),
    shouldIgnoreChartClick: () => session.shouldIgnoreChartClick(),
    tap: (point: { x: number; y: number }, clientX?: number, clientY?: number) =>
      session.tap(point, clientX, clientY),
    doubleClick: (point: { x: number; y: number }) => session.doubleClick(point),
    reset: () => session.reset(),
    resetPointer: () => session.resetPointer(),
    dispose: () => session.dispose(),
  }
}

export type ChartSelectionRuntime = ReturnType<typeof createChartSelectionRuntime>
