import {
  isPolylineArrowKind,
  isTextAnchorKind,
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../../../_lib/chart/chart-drawings'
import { isChartIconKind } from '../../../../_lib/chart/chart-icons'
import type {
  InteractionCancelReason,
  InteractionEffect,
  NormalizedPointer,
} from '../interaction-contract'
import { InteractionEffectRunner } from '../interaction-effect-runner'
import { InteractionOwnerRegistry } from '../interaction-owner-registry'
import { InteractionStore } from '../interaction-store'
import {
  activeTwoPointAnchor,
  isTwoPointCreateKind,
  TWO_POINT_CREATE_KINDS,
  TwoPointCreateBehavior,
  type TwoPointCreateState,
  type TwoPointToolKind,
} from './two-point-create-behavior'
import {
  activeThreePointAnchor,
  EXTENSION_SCOPE_ID,
  ThreePointCreateBehavior,
  type ThreePointCreateState,
} from './three-point-create-behavior'
import { POLYLINE_SCOPE_ID, PolylineCreateBehavior } from './polyline-create-behavior'

export type ChartCreateRuntimePorts = {
  mapPoint: (screen: { x: number; y: number }) => DrawingPoint | null
  preview: (
    scopeId: string,
    p1: DrawingPoint,
    p2?: DrawingPoint | null,
    p3?: DrawingPoint | null,
  ) => void
  schedulePreview: (
    scopeId: string,
    p1: DrawingPoint,
    p2?: DrawingPoint | null,
    p3?: DrawingPoint | null,
  ) => void
  clearPreview: () => void
  discardScheduledPreview: () => void
  complete: (input: {
    kind: ChartDrawingKind
    p1: DrawingPoint
    p2: DrawingPoint
    points?: DrawingPoint[]
  }) => void
  polylinePreview: (points: DrawingPoint[], hover?: DrawingPoint | null) => void
  polylineComplete: (points: DrawingPoint[]) => void
  defaultSecondPoint: (p1: DrawingPoint) => DrawingPoint
  defaultThirdPoint: (p1: DrawingPoint, p2: DrawingPoint) => DrawingPoint
  viewportCenter: () => DrawingPoint | null
}

function pointerFor(
  chartPoint: DrawingPoint | null,
  screen: { x: number; y: number } = { x: 0, y: 0 },
  coarse = false,
): NormalizedPointer {
  return {
    pointerId: 0,
    pointerType: coarse ? 'touch' : 'mouse',
    coarse,
    primary: true,
    screen,
    chartPoint,
  }
}

function isOneShotKind(tool: ChartDrawingKind): boolean {
  return isChartIconKind(tool) || isTextAnchorKind(tool)
}

function isExtension(tool: ChartDrawingKind | null): tool is typeof EXTENSION_SCOPE_ID {
  return tool === EXTENSION_SCOPE_ID
}

/** Shared InteractionStore create router for fine/coarse shapes, extension, polyline, one-shot. */
export function createChartCreateRuntime(
  ports: ChartCreateRuntimePorts,
  gesture = { doubleTapMs: 350, doubleTapPx: 24 },
) {
  const registry = new InteractionOwnerRegistry()
  const defaults = {
    secondPoint: (p1: DrawingPoint) => ports.defaultSecondPoint(p1),
    thirdPoint: (p1: DrawingPoint, p2: DrawingPoint) => ports.defaultThirdPoint(p1, p2),
  }
  for (const kind of TWO_POINT_CREATE_KINDS) {
    registry.registerCreation(new TwoPointCreateBehavior(kind, defaults))
  }
  registry.registerCreation(new ThreePointCreateBehavior(defaults))
  registry.registerCreation(new PolylineCreateBehavior(gesture))

  const effects = new InteractionEffectRunner((effect: InteractionEffect) => {
    if (effect.type === 'preview') {
      const draft = effect.payload as {
        p1: DrawingPoint
        p2?: DrawingPoint | null
        p3?: DrawingPoint | null
      }
      ports.preview(effect.scopeId, draft.p1, draft.p2, draft.p3)
      return
    }
    if (effect.type === 'preview-scheduled') {
      const draft = effect.payload as {
        p1: DrawingPoint
        p2?: DrawingPoint | null
        p3?: DrawingPoint | null
      }
      ports.schedulePreview(effect.scopeId, draft.p1, draft.p2, draft.p3)
      return
    }
    if (effect.type === 'clear-preview') {
      ports.discardScheduledPreview()
      ports.clearPreview()
      return
    }
    if (effect.type === 'complete') {
      ports.complete(effect.payload as {
        kind: ChartDrawingKind
        p1: DrawingPoint
        p2: DrawingPoint
        points?: DrawingPoint[]
      })
      return
    }
    if (effect.type === 'polyline-preview') {
      const payload = effect.payload as { points: DrawingPoint[]; hover?: DrawingPoint }
      ports.polylinePreview(payload.points, payload.hover ?? null)
      return
    }
    if (effect.type === 'polyline-complete') {
      const payload = effect.payload as { points: DrawingPoint[] }
      ports.polylineComplete(payload.points)
    }
  })

  const store = new InteractionStore(registry, effects)

  const isPlacing = (scopeId: string) =>
    store.snapshot.status === 'active' &&
    store.snapshot.scopeId === scopeId &&
    store.snapshot.workflow === 'create'

  const beginOrReplace = (scopeId: string, input: unknown) => {
    if (store.snapshot.status === 'active') store.cancel('replaced')
    return store.begin({ scopeId, workflow: 'create', input })
  }

  return {
    store,
    handles(tool: ChartDrawingKind | null): boolean {
      if (!tool) return false
      return (
        isTwoPointCreateKind(tool) ||
        isExtension(tool) ||
        isPolylineArrowKind(tool) ||
        isOneShotKind(tool)
      )
    },
    handlesFine(tool: ChartDrawingKind | null): boolean {
      return this.handles(tool)
    },
    placing(tool: ChartDrawingKind | null): boolean {
      if (!tool) return false
      if (isPolylineArrowKind(tool)) return isPlacing(POLYLINE_SCOPE_ID)
      if (isExtension(tool)) return isPlacing(EXTENSION_SCOPE_ID)
      return isTwoPointCreateKind(tool) && isPlacing(tool)
    },
    isCoarsePlacing(tool: ChartDrawingKind | null): boolean {
      if (!tool || store.snapshot.status !== 'active') return false
      const state = store.snapshot.state as { pointer?: string }
      if (state.pointer !== 'coarse') return false
      if (isTwoPointCreateKind(tool)) return isPlacing(tool)
      if (isExtension(tool)) return isPlacing(EXTENSION_SCOPE_ID)
      return false
    },
    activeAnchor(tool: ChartDrawingKind | null): DrawingPoint | null {
      if (!tool || store.snapshot.status !== 'active') return null
      if (isTwoPointCreateKind(tool) && isPlacing(tool)) {
        return activeTwoPointAnchor(store.snapshot.state as TwoPointCreateState)
      }
      if (isExtension(tool) && isPlacing(EXTENSION_SCOPE_ID)) {
        return activeThreePointAnchor(store.snapshot.state as ThreePointCreateState)
      }
      return null
    },
    tap(
      tool: ChartDrawingKind,
      screen: { x: number; y: number },
      client?: { x: number; y: number },
    ): boolean {
      const mapped = ports.mapPoint(screen)
      if (!mapped) return true

      if (isOneShotKind(tool)) {
        ports.clearPreview()
        ports.complete({ kind: tool, p1: mapped, p2: mapped })
        return true
      }
      if (isTwoPointCreateKind(tool)) {
        if (!isPlacing(tool)) {
          beginOrReplace(tool, { pointer: 'fine', p1: mapped })
          return true
        }
        store.dispatch({ type: 'pointer-move', pointer: pointerFor(mapped, screen) })
        store.dispatch({ type: 'confirm' })
        return true
      }
      if (isExtension(tool)) {
        if (!isPlacing(EXTENSION_SCOPE_ID)) {
          beginOrReplace(EXTENSION_SCOPE_ID, { pointer: 'fine', p1: mapped })
          return true
        }
        store.dispatch({ type: 'pointer-move', pointer: pointerFor(mapped, screen) })
        store.dispatch({ type: 'confirm' })
        return true
      }
      if (isPolylineArrowKind(tool)) {
        const clientX = client?.x ?? screen.x
        const clientY = client?.y ?? screen.y
        if (!isPlacing(POLYLINE_SCOPE_ID)) {
          beginOrReplace(POLYLINE_SCOPE_ID, { point: mapped, clientX, clientY })
          return true
        }
        store.dispatch({
          type: 'pointer-up',
          pointer: pointerFor(mapped, { x: clientX, y: clientY }),
        })
        return true
      }
      return false
    },
    hover(tool: ChartDrawingKind | null, screen: { x: number; y: number } | null): boolean {
      if (!tool || !this.placing(tool)) return false
      if (isPolylineArrowKind(tool)) {
        if (screen == null) return true
        store.dispatch({
          type: 'pointer-move',
          pointer: pointerFor(ports.mapPoint(screen), screen),
        })
        return true
      }
      if (isExtension(tool)) {
        if (screen == null) return true
        store.dispatch({
          type: 'pointer-move',
          pointer: pointerFor(ports.mapPoint(screen), screen),
        })
        return true
      }
      if (!isTwoPointCreateKind(tool)) return false
      if (screen == null) {
        store.dispatch({ type: 'pointer-move', pointer: pointerFor(null) })
        return true
      }
      store.dispatch({
        type: 'pointer-move',
        pointer: pointerFor(ports.mapPoint(screen), screen),
      })
      return true
    },
    seedCoarse(tool: TwoPointToolKind | typeof EXTENSION_SCOPE_ID): boolean {
      const p1 = ports.viewportCenter()
      if (!p1) return false
      if (tool === EXTENSION_SCOPE_ID) {
        beginOrReplace(EXTENSION_SCOPE_ID, { pointer: 'coarse', p1 })
        return true
      }
      beginOrReplace(tool, { pointer: 'coarse', p1 })
      return true
    },
    moveCoarse(tool: ChartDrawingKind, point: DrawingPoint): boolean {
      if (!this.isCoarsePlacing(tool)) return false
      store.dispatch({ type: 'pointer-move', pointer: pointerFor(point, undefined, true) })
      return true
    },
    confirmCoarse(tool: ChartDrawingKind | null): boolean {
      if (!tool || !this.isCoarsePlacing(tool)) return false
      store.dispatch({ type: 'confirm' })
      return true
    },
    cancel(reason: InteractionCancelReason = 'user'): void {
      if (store.snapshot.status === 'active') store.cancel(reason)
    },
    dispose(): void {
      store.dispose()
    },
  }
}

export type ChartCreateRuntime = ReturnType<typeof createChartCreateRuntime>
