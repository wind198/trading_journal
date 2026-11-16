import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'
import type { BarTimeSeries } from '../../../../_lib/chart/chart-coordinates'
import type { ChartHandle } from '../../price-chart-handle'
import { RectangleBehavior } from '../../_components/objects/rect/rectangle-behavior'
import { TrendlineBehavior } from '../../_components/objects/trendline/trendline-behavior'
import type { InteractionEffect, NormalizedPointer } from '../interaction-contract'
import { InteractionEffectRunner } from '../interaction-effect-runner'
import { InteractionOwnerRegistry } from '../interaction-owner-registry'
import { InteractionStore } from '../interaction-store'
import {
  DrawingEditSession,
  type DrawingEditPorts,
  type StoreEditController,
} from './drawing-edit-session'
import {
  createLegacyEditPartsWithoutTwoPointStoreAnchors,
  type EditDrawingCollections,
  type EditToolSet,
} from './edit-tool-registry'
import type { AnchorEditPhase, ScreenPoint, StoreAnchorBegin } from './edit-contract'

export type ChartEditRuntimePorts = Omit<
  DrawingEditPorts,
  'handle' | 'candles' | 'selectedId' | 'syncHitGeometry' | 'syncLock' | 'markDrag'
> & {
  handle: ChartHandle
  candles: () => BarTimeSeries
  selectedId: () => string | null
  syncHitGeometry: () => void
  syncLock: () => void
  markDrag: () => void
  drawings: () => EditDrawingCollections
}

type PairDrawing = { id: string; p1: DrawingPoint; p2: DrawingPoint }

function twoPointStoreAnchor(input: {
  scopeId: string
  hitTestAnchor: (x: number, y: number) => { id: string; endpoint: 'p1' | 'p2' } | null
  resolveDrawing: (id: string) => PairDrawing | null
}): AnchorEditPhase {
  return {
    kind: 'store',
    beginAnchor(id: string, screen: ScreenPoint): StoreAnchorBegin {
      const hit = input.hitTestAnchor(screen.x, screen.y)
      if (!hit) return null
      if (hit.id !== id) return 'blocked'
      const drawing = input.resolveDrawing(id)
      if (!drawing) return null
      return {
        scopeId: input.scopeId,
        input: {
          id,
          endpoint: hit.endpoint,
          p1: drawing.p1,
          p2: drawing.p2,
        },
      }
    },
  }
}

function buildTools(
  handle: ChartHandle,
  drawings: () => EditDrawingCollections,
): EditToolSet {
  const parts = createLegacyEditPartsWithoutTwoPointStoreAnchors(handle, drawings)
  return {
    press: parts.press,
    primary: parts.primary,
    anchors: [
      twoPointStoreAnchor({
        scopeId: 'trendline',
        hitTestAnchor: (x, y) => handle.trendlines.hitTestAnchor(x, y),
        resolveDrawing: (id) =>
          drawings().trendlines.find((item) => item.id === id) ??
          handle.trendlines.getDrawing(id),
      }),
      twoPointStoreAnchor({
        scopeId: 'rectangle',
        hitTestAnchor: (x, y) => handle.rectangles.hitTestAnchor(x, y),
        resolveDrawing: (id) =>
          drawings().rectangles.find((item) => item.id === id) ??
          handle.rectangles.getDrawing(id),
      }),
      ...parts.afterTwoPointStoreAnchors.map((behavior) => ({
        kind: 'legacy' as const,
        behavior,
      })),
    ],
    body: parts.body,
  }
}

function createStoreEditController(
  store: InteractionStore,
): StoreEditController {
  const editing = () =>
    store.snapshot.status === 'active' && store.snapshot.workflow === 'edit'

  return {
    begin({ scopeId, input, pointerId }) {
      return store.begin({ scopeId, workflow: 'edit', input, pointerId })
    },
    isActive: editing,
    move(pointer: NormalizedPointer) {
      store.dispatch({ type: 'pointer-move', pointer })
    },
    up(pointer: NormalizedPointer) {
      store.dispatch({ type: 'pointer-up', pointer })
    },
    cancel() {
      if (editing()) store.cancel('pointer-cancel')
    },
  }
}

/**
 * Edit hit-order: press → primary → trendline(store) → rectangle(store) → rest → body.
 * Two-point anchors route through InteractionStore + Editable behaviors.
 */
export function createChartEditRuntime(ports: ChartEditRuntimePorts, tapThresholdPx: number) {
  const {
    drawings,
    handle,
    candles,
    selectedId,
    syncHitGeometry,
    syncLock,
    markDrag,
    change,
    changeEnd,
    ...rest
  } = ports

  const registry = new InteractionOwnerRegistry()
  registry.registerEditing(new TrendlineBehavior())
  registry.registerEditing(new RectangleBehavior())

  const effects = new InteractionEffectRunner((effect: InteractionEffect) => {
    if (effect.type === 'change') {
      const payload = effect.payload as { id: string; p1: DrawingPoint; p2: DrawingPoint }
      change(payload.id, payload.p1, payload.p2)
      return
    }
    if (effect.type === 'change-end') {
      const payload = effect.payload as { id: string }
      changeEnd(payload.id)
    }
  })

  const store = new InteractionStore(registry, effects)
  const storeEdit = createStoreEditController(store)

  const session = new DrawingEditSession(
    {
      handle,
      candles,
      selectedId,
      syncHitGeometry,
      syncLock,
      markDrag,
      change,
      changeEnd,
      ...rest,
    },
    tapThresholdPx,
    buildTools(handle, drawings),
    storeEdit,
  )

  return {
    store,
    get isDragging() {
      return session.isDragging
    },
    pointerDown: (event: PointerEvent, point: { x: number; y: number }) =>
      session.pointerDown(event, point),
    pointerMove: (event: PointerEvent, point: { x: number; y: number }) =>
      session.pointerMove(event, point),
    pointerUp: (event: PointerEvent) => session.pointerUp(event),
    pointerCancel: (event: PointerEvent) => session.pointerCancel(event),
    cancelActive: () => session.cancelActive(),
    dispose: () => {
      session.dispose()
      store.dispose()
    },
  }
}

export type ChartEditRuntime = ReturnType<typeof createChartEditRuntime>
