import type { RefObject } from 'react'
import {
  isPolylineArrowKind,
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../_lib/chart/chart-drawings'
import { createChartCreateRuntime } from './_sessions/create/chart-create-runtime'
import {
  isTwoPointCreateKind,
  type TwoPointToolKind,
} from './_sessions/create/two-point-create-behavior'
import { isThreePointTool, type ThreePointToolKind } from './_sessions/create/three-point-create-behavior'
import {
  barIntervalSec,
  chartXAtTime,
  type BarTimeSeries,
} from '../../_lib/chart/chart-coordinates'
import type { IconMarkerDrawing } from './_components/objects/icon/icon-marker-primitive'
import type { RectangleDrawing } from './_components/objects/rect/rectangle-primitive'
import type { FibonacciRangeExtensionDrawing } from './_components/objects/fibonacci-extension/fibonacci-range-extension-primitive'
import type { FibonacciRangeDrawing } from './_components/objects/fibonacci-range/fibonacci-range-primitive'
import type { PolylineArrowDrawing } from './_components/objects/polyline/polyline-arrow-primitive'
import type { TextAnchorDrawing } from './_components/objects/text/text-anchor-primitive'
import type { TrendlineDrawing } from './_components/objects/trendline/trendline-primitive'
import type { WarningCircleDrawing } from './_components/objects/warning-circle/warning-circle-primitive'
import { createChartEditRuntime, type ChartEditRuntime } from './_sessions/edit/chart-edit-runtime'
import { createChartSelectionRuntime, type ChartSelectionRuntime } from './_sessions/edit/chart-selection-runtime'
import { DrawingPreviewScheduler } from './drawing-preview-scheduler'
import { DrawingEditPreviewScheduler } from './drawing-edit-preview'
import { ChartPointerAdapter } from './chart-pointer-adapter'
import { isCoarsePointerEvent, shapePreviewFollowsPointer as previewFollowsPointer } from './chart-pointer-gesture'
import { CreationPointerSession } from './_sessions/create/creation-pointer-session'
import { clickToPoint, viewportCenterPoint, type ChartHandle } from './price-chart-handle'

const TAP_MOVE_THRESHOLD_PX = 12
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 24

import type { ParallelChannelDrawing } from './_components/objects/parallel-channel/parallel-channel-primitive'

type ShapeDrawTool = 'parallel_channel' | 'fibonacci_range_extension' | 'trendline' | 'fibonacci_range' | 'rectangle' | 'warning_circle'
export function isShapeDrawTool(tool: ChartDrawingKind | null): tool is ShapeDrawTool {
  return tool === 'parallel_channel' || tool === 'fibonacci_range_extension' || tool === 'fibonacci_range' || tool === 'trendline' || tool === 'rectangle' || tool === 'warning_circle'
}

export function isTwoPointDrawTool(tool: ChartDrawingKind | null): tool is TwoPointToolKind {
  return isTwoPointCreateKind(tool)
}

/** Coarse-pointer shapes that use viewport seed → drag → tap confirm. */
export function isTouchSeedShapeTool(
  tool: ChartDrawingKind | null,
): tool is ShapeDrawTool {
  return isShapeDrawTool(tool)
}

export function defaultShapePreviewP2(
  p1: DrawingPoint,
  bars: readonly { time: number }[],
): DrawingPoint {
  const dt = barIntervalSec(bars) ?? 60
  const priceNudge = Math.max(Math.abs(p1.price) * 0.00025, 0.00005)
  return { time: p1.time + dt * 3, price: p1.price + priceNudge }
}

export type PriceChartInteractionRefs = {
  drawToolRef: RefObject<ChartDrawingKind | null>
  seedCoarseTwoPointRef: RefObject<((tool: TwoPointToolKind) => boolean) | null>
  seedCoarseThreePointRef: RefObject<((tool: ThreePointToolKind) => boolean) | null>
  interactionCancelRef: RefObject<(() => void) | null>
  editSessionRef: RefObject<ChartEditRuntime | null>
  selectionSessionRef: RefObject<ChartSelectionRuntime | null>
  pointerCoarseRef: RefObject<boolean>
  pointerCaptureElRef: RefObject<HTMLElement | null>
  chartElRef: RefObject<HTMLElement | null>
  selectedIdRef: RefObject<string | null>
  candlesRef: RefObject<BarTimeSeries>
  trendlinesRef: RefObject<readonly TrendlineDrawing[]>
  rectanglesRef: RefObject<readonly RectangleDrawing[]>
  fibonacciRangesRef: RefObject<readonly FibonacciRangeDrawing[]>
  parallelChannelsRef: RefObject<readonly ParallelChannelDrawing[]>
  fibonacciExtensionsRef: RefObject<readonly FibonacciRangeExtensionDrawing[]>
  iconsRef: RefObject<readonly IconMarkerDrawing[]>
  textAnchorsRef: RefObject<readonly TextAnchorDrawing[]>
  warningCirclesRef: RefObject<readonly WarningCircleDrawing[]>
  polylinesRef: RefObject<readonly PolylineArrowDrawing[]>
  setShapeDraftRef: RefObject<(p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null) => void>
  onCompleteRef: RefObject<
    | ((input: { kind: ChartDrawingKind; p1: DrawingPoint; p2: DrawingPoint; points?: DrawingPoint[] }) => void)
    | undefined
  >
  onChangeRef: RefObject<
    ((id: string, p1: DrawingPoint, p2: DrawingPoint) => void) | undefined
  >
  onChangeEndRef: RefObject<((id: string) => void) | undefined>
  onPolylineCompleteRef: RefObject<((input: { points: DrawingPoint[] }) => void) | undefined>
  onPolylineChangeRef: RefObject<((id: string, points: DrawingPoint[]) => void) | undefined>
  onPolylineChangeEndRef: RefObject<((id: string) => void) | undefined>
  onPolylineLabelEditRef: RefObject<((id: string) => void) | undefined>
}

export type PriceChartInteractionHelpers = {
  clearDrafts: () => void
  selectDrawing: (id: string | null) => void
  setShapeDraft: (p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null) => void
  syncInteractionLock: () => void
  setPolylineDraft: (points: DrawingPoint[], previewPoint?: DrawingPoint | null) => void
  syncDrawOverlay: () => void
}

export function createChartInteractionComposition(input: {
  handle: ChartHandle
  chartEl: HTMLElement
  overlayEl: HTMLElement | null
  refs: PriceChartInteractionRefs
  helpers: PriceChartInteractionHelpers
}) {
  const { handle, chartEl, overlayEl, refs, helpers } = input
  const {
    clearDrafts,
    selectDrawing,
    syncInteractionLock,
    setPolylineDraft,
    syncDrawOverlay,
  } = helpers

  refs.chartElRef.current = chartEl

  const pointer = new ChartPointerAdapter(handle, chartEl, refs.pointerCaptureElRef)
  const creationPointer = new CreationPointerSession(
    (screen) => clickToPoint(handle, screen, refs.candlesRef.current),
    TAP_MOVE_THRESHOLD_PX,
  )
  const previewScheduler = new DrawingPreviewScheduler((draft) =>
    refs.setShapeDraftRef.current(draft.p1, draft.p2, draft.p3))
  const flushDraftRaf = () => previewScheduler.flush()
  const discardDraftRaf = () => previewScheduler.discard()
  const scheduleShapeDraft = (p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null) =>
    previewScheduler.schedule(p1, p2, p3)

  const createRuntime = createChartCreateRuntime({
    mapPoint: (screen) => clickToPoint(handle, screen, refs.candlesRef.current),
    preview: (_scopeId, p1, p2, p3) => refs.setShapeDraftRef.current(p1, p2, p3),
    schedulePreview: (_scopeId, p1, p2, p3) => scheduleShapeDraft(p1, p2, p3),
    clearPreview: clearDrafts,
    discardScheduledPreview: discardDraftRaf,
    complete: (drawing) => refs.onCompleteRef.current?.(drawing),
    polylinePreview: (points, hover) => setPolylineDraft(points, hover),
    polylineComplete: (points) => refs.onPolylineCompleteRef.current?.({ points }),
    defaultSecondPoint: (p1) => defaultShapePreviewP2(p1, refs.candlesRef.current),
    defaultThirdPoint: (p1, p2) => ({
      time: defaultShapePreviewP2(p2, refs.candlesRef.current).time,
      price: refs.drawToolRef.current === 'parallel_channel' ? p2.price + (p2.price-p1.price) + Math.max(Math.abs(p2.price)*0.0005,0.0001) : (p1.price + p2.price) / 2,
    }),
    viewportCenter: () => viewportCenterPoint(handle, refs.candlesRef.current),
  }, { doubleTapMs: DOUBLE_TAP_MS, doubleTapPx: DOUBLE_TAP_PX })

  refs.interactionCancelRef.current = () => createRuntime.cancel('tool-change')
  refs.seedCoarseTwoPointRef.current = (tool) => createRuntime.seedCoarse(tool)
  refs.seedCoarseThreePointRef.current = (tool) => createRuntime.seedCoarse(tool)

  const drawingPointToScreen = (point: DrawingPoint): { x: number; y: number } | null => {
    const x = chartXAtTime(handle.chart, point.time, refs.candlesRef.current)
    const y = handle.price.priceToCoordinate(point.price)
    if (x == null || y == null) return null
    return { x, y }
  }

  const syncDrawingHitGeometry = () => {
    handle.trendlines.updateAllViews()
    handle.rectangles.updateAllViews()
    handle.fibonacciRanges.updateAllViews()
    handle.parallelChannels.updateAllViews()
    handle.fibonacciExtensions.updateAllViews()
    handle.icons.updateAllViews()
    handle.polylines.updateAllViews()
    handle.textAnchors.updateAllViews()
    handle.warningCircles.updateAllViews()
  }

  const selectionRuntime = createChartSelectionRuntime({
    handle,
    syncHitGeometry: syncDrawingHitGeometry,
    select: selectDrawing,
    editLabel: (id) => refs.onPolylineLabelEditRef.current?.(id),
  }, { doubleTapMs: DOUBLE_TAP_MS, doubleTapPx: DOUBLE_TAP_PX })
  refs.selectionSessionRef.current = selectionRuntime

  const applyPointerHitBoost = (event: PointerEvent) =>
    pointer.setHitBoost(isCoarsePointerEvent(event, refs.pointerCoarseRef.current))

  const isCoarsePointer = (event: PointerEvent) =>
    isCoarsePointerEvent(event, refs.pointerCoarseRef.current)

  const shapePreviewFollowsPointer = (event?: PointerEvent) =>
    previewFollowsPointer(refs.pointerCoarseRef.current, event)

  const handleChartTap = (
    point: { x: number; y: number },
    clientX?: number,
    clientY?: number,
  ) => {
    syncDrawingHitGeometry()
    const tool = refs.drawToolRef.current
    if (tool) {
      if (isTouchSeedShapeTool(tool) && refs.pointerCoarseRef.current) return
      if (createRuntime.handles(tool)) {
        createRuntime.tap(
          tool,
          point,
          clientX != null && clientY != null ? { x: clientX, y: clientY } : undefined,
        )
        return
      }
      return
    }
    selectionRuntime.tap(point, clientX, clientY)
  }

  const onChartClick: Parameters<ChartHandle['chart']['subscribeClick']>[0] = (param) => {
    if (!param.point) return
    if (refs.drawToolRef.current) return
    if (selectionRuntime.shouldIgnoreChartClick()) return
    handleChartTap(param.point, param.point.x, param.point.y)
  }

  const updateDraftPreview = (param: { point?: { x: number; y: number } }) => {
    const tool = refs.drawToolRef.current
    if (!tool || !createRuntime.handles(tool)) return
    if (isTouchSeedShapeTool(tool) && !shapePreviewFollowsPointer()) return
    if (isPolylineArrowKind(tool)) return
    createRuntime.hover(tool, param.point ?? null)
  }

  const localPoint = (event: MouseEvent) => pointer.localPoint(event)

  const setCapture = (event: PointerEvent, el: HTMLElement) => pointer.capture(event, el)
  const releaseCapture = (event: PointerEvent) => pointer.release(event)

  const restoreEditPrimitives = () => {
    handle.trendlines.setLines(refs.trendlinesRef.current)
    handle.rectangles.setRects(refs.rectanglesRef.current)
    handle.fibonacciRanges.setRanges(refs.fibonacciRangesRef.current)
    handle.parallelChannels.setChannels(refs.parallelChannelsRef.current)
    handle.fibonacciExtensions.setExtensions(refs.fibonacciExtensionsRef.current)
    handle.warningCircles.setCircles(refs.warningCirclesRef.current)
    handle.icons.setIcons(refs.iconsRef.current)
    handle.textAnchors.setAnchors(refs.textAnchorsRef.current)
    handle.polylines.setPolylines(refs.polylinesRef.current)
  }

  const editPreview = new DrawingEditPreviewScheduler(handle, restoreEditPrimitives)
  let lastTwoPoint: { id: string; p1: DrawingPoint; p2: DrawingPoint } | null = null
  let lastPolyline: { id: string; points: DrawingPoint[] } | null = null

  const editRuntimeInner = createChartEditRuntime({
    handle,
    candles: () => refs.candlesRef.current,
    selectedId: () => refs.selectedIdRef.current,
    select: (id) => selectDrawing(id),
    syncHitGeometry: syncDrawingHitGeometry,
    capture: (event) => setCapture(event, chartEl),
    release: releaseCapture,
    releaseById: (pointerId) => pointer.releaseById(pointerId),
    syncLock: syncInteractionLock,
    markDrag: () => selectionRuntime.markDrag(),
    change: (id, p1, p2) => {
      lastTwoPoint = { id, p1, p2 }
      lastPolyline = null
      editPreview.scheduleTwoPoint(id, p1, p2)
    },
    changeEnd: (id) => {
      editPreview.flush()
      if (lastTwoPoint?.id === id) {
        refs.onChangeRef.current?.(id, lastTwoPoint.p1, lastTwoPoint.p2)
      }
      lastTwoPoint = null
      refs.onChangeEndRef.current?.(id)
    },
    polylineChange: (id, points) => {
      lastPolyline = { id, points }
      lastTwoPoint = null
      editPreview.schedulePolyline(id, points)
    },
    polylineChangeEnd: (id) => {
      editPreview.flush()
      if (lastPolyline?.id === id) {
        refs.onPolylineChangeRef.current?.(id, lastPolyline.points)
      }
      lastPolyline = null
      refs.onPolylineChangeEndRef.current?.(id)
    },
    drawings: () => ({
      trendlines: refs.trendlinesRef.current,
      rectangles: refs.rectanglesRef.current,
      fibonacciRanges: refs.fibonacciRangesRef.current,
      icons: refs.iconsRef.current,
      textAnchors: refs.textAnchorsRef.current,
      warningCircles: refs.warningCirclesRef.current,
    }),
  }, TAP_MOVE_THRESHOLD_PX)

  const editRuntime: ChartEditRuntime = {
    get store() {
      return editRuntimeInner.store
    },
    get isDragging() {
      return editRuntimeInner.isDragging
    },
    pointerDown: (event, point) => editRuntimeInner.pointerDown(event, point),
    pointerMove: (event, point) => editRuntimeInner.pointerMove(event, point),
    pointerUp: (event) => editRuntimeInner.pointerUp(event),
    pointerCancel: (event) => {
      editPreview.discardAndRestore()
      lastTwoPoint = null
      lastPolyline = null
      editRuntimeInner.pointerCancel(event)
    },
    cancelActive: () => {
      editPreview.discardAndRestore()
      lastTwoPoint = null
      lastPolyline = null
      editRuntimeInner.cancelActive()
    },
    dispose: () => {
      editPreview.discard()
      lastTwoPoint = null
      lastPolyline = null
      editRuntimeInner.dispose()
    },
  }
  refs.editSessionRef.current = editRuntime

  const onDrawOverlayPointerDown = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    pointer.cacheRect()
    creationPointer.cancel()
    flushDraftRaf()
    creationPointer.begin(event.pointerId, event.clientX, event.clientY)
    event.preventDefault()
    if (overlayEl) setCapture(event, overlayEl)

    const tool = refs.drawToolRef.current
    if (tool && isPolylineArrowKind(tool)) return

    if (isCoarsePointer(event) && isTouchSeedShapeTool(tool)) {
      if (!createRuntime.isCoarsePlacing(tool)) {
        if (isTwoPointDrawTool(tool)) createRuntime.seedCoarse(tool)
        else if (isThreePointTool(tool)) createRuntime.seedCoarse(tool)
      }
      const active = createRuntime.activeAnchor(tool)
      const screen = active ? drawingPointToScreen(active) : null
      if (screen) creationPointer.begin(event.pointerId, event.clientX, event.clientY, screen)
      selectionRuntime.suppressNextClick()
    }
  }

  const onDrawOverlayPointerMove = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    event.preventDefault()
    const point = localPoint(event)
    const tool = refs.drawToolRef.current

    if (tool && isPolylineArrowKind(tool)) {
      createRuntime.hover(tool, point)
      return
    }

    if (isCoarsePointer(event) && isTouchSeedShapeTool(tool) && createRuntime.isCoarsePlacing(tool)) {
      const mapped = creationPointer.move(event.pointerId, event.clientX, event.clientY)
      if (!mapped) return
      createRuntime.moveCoarse(tool, mapped)
      return
    }

    if (createRuntime.placing(tool) && shapePreviewFollowsPointer(event)) {
      updateDraftPreview({ point })
    }
  }

  const onDrawOverlayPointerUp = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    flushDraftRaf()
    pointer.clearRect()
    const gesture = creationPointer.finish(event.pointerId, event.clientX, event.clientY)

    const shapeTool = refs.drawToolRef.current
    if (isTouchSeedShapeTool(shapeTool) && isCoarsePointer(event)) {
      releaseCapture(event)
      selectionRuntime.suppressNextClick()
      if (gesture?.tap) createRuntime.confirmCoarse(shapeTool)
      return
    }

    releaseCapture(event)

    if (!gesture) return
    if (!gesture.tap && !isPolylineArrowKind(refs.drawToolRef.current)) return

    selectionRuntime.suppressNextClick()
    handleChartTap(localPoint(event), event.clientX, event.clientY)
    syncInteractionLock()
  }

  const onDrawOverlayPointerCancel = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    const coarse = isCoarsePointer(event) && isTouchSeedShapeTool(refs.drawToolRef.current)
    createRuntime.cancel('pointer-cancel')
    if (coarse) discardDraftRaf()
    else flushDraftRaf()
    pointer.clearRect()
    creationPointer.cancel()
    releaseCapture(event)
  }

  const onChartPointerDown = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    applyPointerHitBoost(event)
    selectionRuntime.pointerDown(event)
    editRuntime.pointerDown(event, localPoint(event))
  }

  const onChartPointerMove = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    editRuntime.pointerMove(event, localPoint(event))
  }

  const onChartPointerUp = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    if (editRuntime.pointerUp(event)) {
      selectionRuntime.cancelPointer()
      return
    }
    releaseCapture(event)
    if (!selectionRuntime.pointerUp(event)) return
    handleChartTap(localPoint(event), event.clientX, event.clientY)
    syncInteractionLock()
  }

  const onDoubleClick = (event: MouseEvent) => {
    if (refs.drawToolRef.current) return
    const target = event.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
    if (selectionRuntime.doubleClick(localPoint(event as unknown as PointerEvent))) event.preventDefault()
  }

  const onChartPointerCancel = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    selectionRuntime.cancelPointer()
    editRuntime.pointerCancel(event)
  }

  const handlers = {
    chartClick: onChartClick,
    crosshairMove: updateDraftPreview,
    chartPointerDown: onChartPointerDown,
    chartPointerMove: onChartPointerMove,
    chartPointerUp: onChartPointerUp,
    chartPointerCancel: onChartPointerCancel,
    chartDoubleClick: onDoubleClick,
    overlayPointerDown: onDrawOverlayPointerDown,
    overlayPointerMove: onDrawOverlayPointerMove,
    overlayPointerUp: onDrawOverlayPointerUp,
    overlayPointerCancel: onDrawOverlayPointerCancel,
  }
  return {
    handlers,
    start: syncDrawOverlay,
    dispose: () => {
      createRuntime.dispose()
      refs.interactionCancelRef.current = null
      editRuntime.dispose()
      refs.editSessionRef.current = null
      selectionRuntime.dispose()
      refs.selectionSessionRef.current = null
      discardDraftRaf()
      editPreview.discard()
      refs.seedCoarseThreePointRef.current = null
      refs.seedCoarseTwoPointRef.current = null
      pointer.dispose()
      creationPointer.dispose()
      pointer.clearRect()
      refs.chartElRef.current = null
    },
  }
}
