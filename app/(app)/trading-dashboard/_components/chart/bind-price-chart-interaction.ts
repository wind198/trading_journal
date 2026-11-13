import type { RefObject } from 'react'
import {
  isPolylineArrowKind,
  isTextAnchorKind,
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../_lib/chart/chart-drawings'
import { isChartIconKind } from '../../_lib/chart/chart-icons'
import {
  barIntervalSec,
  chartXAtTime,
  type BarTimeSeries,
} from '../../_lib/chart/chart-coordinates'
import type { IconMarkerDrawing } from './primitives/icon-marker-primitive'
import type { RectangleDrawing } from './primitives/rectangle-primitive'
import type { FibonacciRangeDrawing } from './primitives/fibonacci-range-primitive'
import type { TextAnchorDrawing } from './primitives/text-anchor-primitive'
import type { TrendlineDrawing } from './primitives/trendline-primitive'
import type { WarningCircleDrawing } from './primitives/warning-circle-primitive'
import { clickToPoint, viewportCenterPoint, type ChartHandle } from './price-chart-handle'

const TAP_MOVE_THRESHOLD_PX = 12
const TOUCH_HIT_BOOST = 1.75
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 24

type ShapeDrawTool = 'trendline' | 'fibonacci_range' | 'rectangle' | 'warning_circle'
/** Touch seed/drag/tap-confirm for two-anchor drawing tools. */
export type TouchShapePhase = 'idle' | 'placing_p1' | 'placing_p2'

export function isShapeDrawTool(tool: ChartDrawingKind | null): tool is ShapeDrawTool {
  return tool === 'fibonacci_range' || tool === 'trendline' || tool === 'rectangle' || tool === 'warning_circle'
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

/** Seed single p1 at viewport center; enter placing_p1 (p2 only after first tap). */
export function seedTouchShapeDraft(input: {
  handle: ChartHandle
  candles: BarTimeSeries
  draftRef: RefObject<DrawingPoint | null>
  touchShapePhaseRef: RefObject<TouchShapePhase>
  setShapeDraft: (p1: DrawingPoint, p2?: DrawingPoint | null) => void
}): boolean {
  const p1 = viewportCenterPoint(input.handle, input.candles)
  if (!p1) return false
  input.draftRef.current = p1
  input.touchShapePhaseRef.current = 'placing_p1'
  input.setShapeDraft(p1, null)
  return true
}

export type DrawingDragState = {
  id: string
  endpoint: 'p1' | 'p2'
  p1: DrawingPoint
  p2: DrawingPoint
  moveWhole: boolean
  moveOrigin?: DrawingPoint
}

export type PolylineDragState = {
  id: string
  vertexIndex: number
  moveOrigin?: DrawingPoint
  points: DrawingPoint[]
}

export type PriceChartInteractionRefs = {
  drawToolRef: RefObject<ChartDrawingKind | null>
  draftRef: RefObject<DrawingPoint | null>
  dragRef: RefObject<DrawingDragState | null>
  polylineDragRef: RefObject<PolylineDragState | null>
  didDragRef: RefObject<boolean>
  skipNextClickRef: RefObject<boolean>
  tapStartRef: RefObject<{ x: number; y: number; pointerId: number } | null>
  iconPressRef: RefObject<{
    id: string
    x: number
    y: number
    pointerId: number
  } | null>
  touchShapePhaseRef: RefObject<TouchShapePhase>
  touchShapeDragStartRef: RefObject<{ x: number; y: number } | null>
  shapePreviewP2Ref: RefObject<DrawingPoint | null>
  polylineDraftRef: RefObject<DrawingPoint[]>
  lastPolyTapRef: RefObject<{ time: number; x: number; y: number } | null>
  lastLabelTapRef: RefObject<{ id: string; time: number; x: number; y: number } | null>
  pointerCoarseRef: RefObject<boolean>
  pointerCaptureElRef: RefObject<HTMLElement | null>
  chartElRef: RefObject<HTMLElement | null>
  selectedIdRef: RefObject<string | null>
  candlesRef: RefObject<BarTimeSeries>
  trendlinesRef: RefObject<readonly TrendlineDrawing[]>
  rectanglesRef: RefObject<readonly RectangleDrawing[]>
  fibonacciRangesRef: RefObject<readonly FibonacciRangeDrawing[]>
  iconsRef: RefObject<readonly IconMarkerDrawing[]>
  textAnchorsRef: RefObject<readonly TextAnchorDrawing[]>
  warningCirclesRef: RefObject<readonly WarningCircleDrawing[]>
  setShapeAwaitingP2Ref: RefObject<(value: boolean) => void>
  setShapeDraftRef: RefObject<(p1: DrawingPoint, p2?: DrawingPoint | null) => void>
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
  setShapeDraft: (p1: DrawingPoint, p2?: DrawingPoint | null) => void
  syncInteractionLock: () => void
  setPolylineDraft: (points: DrawingPoint[], previewPoint?: DrawingPoint | null) => void
  syncDrawOverlay: () => void
}

export function bindPriceChartInteraction(input: {
  handle: ChartHandle
  chartEl: HTMLElement
  overlayEl: HTMLElement | null
  refs: PriceChartInteractionRefs
  helpers: PriceChartInteractionHelpers
}): () => void {
  const { handle, chartEl, overlayEl, refs, helpers } = input
  const {
    clearDrafts,
    selectDrawing,
    setShapeDraft,
    syncInteractionLock,
    setPolylineDraft,
    syncDrawOverlay,
  } = helpers

  refs.chartElRef.current = chartEl

  type TouchDragOrigin = {
    clientX: number
    clientY: number
    screenX: number
    screenY: number
    point: DrawingPoint
  }
  let touchDragOrigin: TouchDragOrigin | null = null
  let pendingDraftRaf: number | null = null
  let pendingDraft: { p1: DrawingPoint; p2?: DrawingPoint | null } | null = null
  let chartRectCache: DOMRect | null = null

  const flushDraftRaf = () => {
    if (pendingDraftRaf != null) {
      cancelAnimationFrame(pendingDraftRaf)
      pendingDraftRaf = null
    }
    if (pendingDraft) {
      const draft = pendingDraft
      pendingDraft = null
      refs.setShapeDraftRef.current(draft.p1, draft.p2)
    }
  }

  const scheduleShapeDraft = (p1: DrawingPoint, p2?: DrawingPoint | null) => {
    pendingDraft = { p1, p2 }
    if (pendingDraftRaf != null) return
    pendingDraftRaf = requestAnimationFrame(() => {
      pendingDraftRaf = null
      const draft = pendingDraft
      pendingDraft = null
      if (draft) refs.setShapeDraftRef.current(draft.p1, draft.p2)
    })
  }

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
    handle.fibonacciExtensions.updateAllViews()
    handle.icons.updateAllViews()
    handle.polylines.updateAllViews()
    handle.textAnchors.updateAllViews()
    handle.warningCircles.updateAllViews()
  }

  const drawingPoints = (id: string): { p1: DrawingPoint; p2: DrawingPoint } | null => {
    const fromTrend = refs.trendlinesRef.current.find((d) => d.id === id)
    if (fromTrend) return { p1: fromTrend.p1, p2: fromTrend.p2 }
    const fromFib = refs.fibonacciRangesRef.current.find((d) => d.id === id)
    if (fromFib) return { p1: fromFib.p1, p2: fromFib.p2 }
    const fromRect = refs.rectanglesRef.current.find((d) => d.id === id)
    if (fromRect) return { p1: fromRect.p1, p2: fromRect.p2 }
    const fromCircle = refs.warningCirclesRef.current.find((d) => d.id === id)
    if (fromCircle) return { p1: fromCircle.p1, p2: fromCircle.p2 }
    const fromIcon = refs.iconsRef.current.find((d) => d.id === id)
    if (fromIcon) return { p1: fromIcon.p1, p2: fromIcon.p1 }
    const fromText = refs.textAnchorsRef.current.find((d) => d.id === id)
    if (fromText) return { p1: fromText.p1, p2: fromText.p1 }
    const line = handle.trendlines.getDrawing(id)
    if (line) return { p1: line.p1, p2: line.p2 }
    const rect = handle.rectangles.getDrawing(id)
    if (rect) return { p1: rect.p1, p2: rect.p2 }
    const circle = handle.warningCircles.getDrawing(id)
    if (circle) return { p1: circle.p1, p2: circle.p2 }
    const icon = handle.icons.getDrawing(id)
    if (icon) return { p1: icon.p1, p2: icon.p1 }
    const text = handle.textAnchors.getDrawing(id)
    if (text) return { p1: text.p1, p2: text.p1 }
    return null
  }

  const pointFromEvent = (param: { point?: { x: number; y: number } }) => {
    if (!param.point) return null
    return clickToPoint(handle, param.point, refs.candlesRef.current)
  }

  const applyPointerHitBoost = (event: PointerEvent) => {
    const boost =
      event.pointerType === 'touch' || refs.pointerCoarseRef.current ? TOUCH_HIT_BOOST : 1
    handle.trendlines.setHitBoost(boost)
    handle.rectangles.setHitBoost(boost)
    handle.fibonacciRanges.setHitBoost(boost)
    handle.fibonacciExtensions.setHitBoost(boost)
    handle.icons.setHitBoost(boost)
    handle.polylines.setHitBoost(boost)
    handle.textAnchors.setHitBoost(boost)
    handle.warningCircles.setHitBoost(boost)
  }

  const isCoarsePointer = (event: PointerEvent) =>
    event.pointerType === 'touch' || refs.pointerCoarseRef.current

  const shapePreviewFollowsPointer = (event?: PointerEvent) => {
    if (event) return !isCoarsePointer(event)
    return !refs.pointerCoarseRef.current
  }

  const isDoubleTapAt = (clientX: number, clientY: number) => {
    const prev = refs.lastPolyTapRef.current
    if (!prev) return false
    const dt = Date.now() - prev.time
    const dist = Math.hypot(clientX - prev.x, clientY - prev.y)
    return dt <= DOUBLE_TAP_MS && dist <= DOUBLE_TAP_PX
  }

  const tryOpenLabelEditor = (clientX: number, clientY: number, polylineId: string) => {
    const prev = refs.lastLabelTapRef.current
    const now = Date.now()
    if (
      prev &&
      prev.id === polylineId &&
      now - prev.time <= DOUBLE_TAP_MS &&
      Math.hypot(clientX - prev.x, clientY - prev.y) <= DOUBLE_TAP_PX
    ) {
      refs.lastLabelTapRef.current = null
      refs.onPolylineLabelEditRef.current?.(polylineId)
      return true
    }
    refs.lastLabelTapRef.current = { id: polylineId, time: now, x: clientX, y: clientY }
    return false
  }

  const handlePolylinePlacement = (
    point: { x: number; y: number },
    clientX: number,
    clientY: number,
  ) => {
    const mapped = clickToPoint(handle, point, refs.candlesRef.current)
    if (!mapped) return

    if (isDoubleTapAt(clientX, clientY)) {
      refs.lastPolyTapRef.current = null
      const points = [...refs.polylineDraftRef.current, mapped]
      if (points.length >= 2) {
        refs.onPolylineCompleteRef.current?.({ points })
        clearDrafts()
      }
      return
    }

    refs.polylineDraftRef.current = [...refs.polylineDraftRef.current, mapped]
    setPolylineDraft(refs.polylineDraftRef.current)
    refs.lastPolyTapRef.current = { time: Date.now(), x: clientX, y: clientY }
  }

  const confirmTouchShapePoint = () => {
    flushDraftRaf()
    const tool = refs.drawToolRef.current
    if (!isTouchSeedShapeTool(tool)) return
    const p1 = refs.draftRef.current
    if (!p1) return
    const phase = refs.touchShapePhaseRef.current
    if (phase === 'placing_p1') {
      const p2 =
        refs.shapePreviewP2Ref.current ??
        defaultShapePreviewP2(p1, refs.candlesRef.current)
      refs.touchShapePhaseRef.current = 'placing_p2'
      refs.setShapeDraftRef.current(p1, p2)
      refs.setShapeAwaitingP2Ref.current(true)
      return
    }
    if (phase === 'placing_p2') {
      const p2 = refs.shapePreviewP2Ref.current
      if (!p2) return
      clearDrafts()
      refs.onCompleteRef.current?.({ kind: tool, p1, p2 })
    }
  }

  const handleChartTap = (
    point: { x: number; y: number },
    clientX?: number,
    clientY?: number,
  ) => {
    syncDrawingHitGeometry()
    const tool = refs.drawToolRef.current
    if (tool) {
      if (isTouchSeedShapeTool(tool) && refs.pointerCoarseRef.current) return
      const mapped = clickToPoint(handle, point, refs.candlesRef.current)
      if (!mapped) return
      if (isChartIconKind(tool) || isTextAnchorKind(tool)) {
        clearDrafts()
        refs.onCompleteRef.current?.({ kind: tool, p1: mapped, p2: mapped })
        return
      }
      if (tool === 'fibonacci_range_extension') {
        const points = [...refs.polylineDraftRef.current, mapped]
        if (points.length === 3) {
          clearDrafts()
          refs.onCompleteRef.current?.({ kind: tool, p1: points[0], p2: points[2], points })
        } else {
          refs.polylineDraftRef.current = points
          refs.draftRef.current = points[0]
          handle.fibonacciExtensions.setDraft({ p1: points[0], p2: points[1] })
        }
        return
      }
      if (isPolylineArrowKind(tool)) {
        if (clientX == null || clientY == null) return
        handlePolylinePlacement(point, clientX, clientY)
        return
      }
      const first = refs.draftRef.current
      if (!first) {
        refs.draftRef.current = mapped
        setShapeDraft(mapped)
        return
      }
      clearDrafts()
      refs.onCompleteRef.current?.({ kind: tool, p1: first, p2: mapped })
      return
    }
    const lineHit = handle.trendlines.hitTest(point.x, point.y)
    const rectHit = handle.rectangles.hitTest(point.x, point.y)
    const fibHit = handle.fibonacciRanges.hitTest(point.x, point.y)
    const extensionHit = handle.fibonacciExtensions.hitTest(point.x, point.y)
    const circleHit = handle.warningCircles.hitTest(point.x, point.y)
    const iconHit = handle.icons.hitTest(point.x, point.y)
    const polyHit = handle.polylines.hitTest(point.x, point.y)
    const textHit = handle.textAnchors.hitTest(point.x, point.y)
    const hit = [lineHit, fibHit, extensionHit, rectHit, circleHit, iconHit, polyHit, textHit]
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0]
    const hitId = hit?.externalId ?? null
    if (
      hitId &&
      (polyHit?.externalId === hitId ||
        textHit?.externalId === hitId ||
        circleHit?.externalId === hitId) &&
      clientX != null &&
      clientY != null &&
      tryOpenLabelEditor(clientX, clientY, hitId)
    ) {
      selectDrawing(hitId)
      return
    }
    selectDrawing(hitId)
  }

  handle.chart.subscribeClick((param) => {
    if (!param.point) return
    if (refs.drawToolRef.current) return
    if (refs.skipNextClickRef.current) {
      refs.skipNextClickRef.current = false
      return
    }
    if (refs.didDragRef.current) {
      refs.didDragRef.current = false
      return
    }
    handleChartTap(param.point, param.point.x, param.point.y)
  })

  const updateDraftPreview = (param: { point?: { x: number; y: number } }) => {
    const tool = refs.drawToolRef.current
    if (tool === 'fibonacci_range_extension') {
      const points = refs.polylineDraftRef.current
      const hover = pointFromEvent(param)
      if (!points.length || !hover) return
      handle.fibonacciExtensions.setDraft(points.length === 1
        ? { p1: points[0], p2: hover }
        : { p1: points[0], p2: points[1], p3: hover })
      return
    }
    if (tool && isPolylineArrowKind(tool)) return
    if (!tool) return
    const first = refs.draftRef.current
    if (!first) return
    if (tool && isShapeDrawTool(tool) && !shapePreviewFollowsPointer()) return
    if (!param.point) {
      setShapeDraft(first)
      return
    }
    const hover = pointFromEvent(param)
    if (!hover) return
    setShapeDraft(first, hover)
  }

  handle.chart.subscribeCrosshairMove(updateDraftPreview)

  const localPoint = (event: PointerEvent) => {
    const rect = chartRectCache ?? chartEl.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const activeTouchShapePoint = (): DrawingPoint | null => {
    const phase = refs.touchShapePhaseRef.current
    if (phase === 'placing_p1') return refs.draftRef.current
    if (phase === 'placing_p2') {
      return refs.shapePreviewP2Ref.current ?? refs.draftRef.current
    }
    return null
  }

  const setCapture = (event: PointerEvent, el: HTMLElement) => {
    el.setPointerCapture(event.pointerId)
    refs.pointerCaptureElRef.current = el
  }

  const releaseCapture = (event: PointerEvent) => {
    const el = refs.pointerCaptureElRef.current ?? chartEl
    refs.pointerCaptureElRef.current = null
    try {
      el.releasePointerCapture(event.pointerId)
    } catch {
      /* lost capture */
    }
  }

  const onDrawOverlayPointerDown = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    chartRectCache = chartEl.getBoundingClientRect()
    touchDragOrigin = null
    flushDraftRaf()
    // Skip hitBoost / syncInteractionLock — draw tool already locks chart.
    refs.tapStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    refs.didDragRef.current = false
    event.preventDefault()
    if (overlayEl) setCapture(event, overlayEl)
    // Chart already locked while drawTool is set — skip applyOptions thrash.

    const tool = refs.drawToolRef.current
    if (tool && isPolylineArrowKind(tool)) return

    // Shape touch: seed already done; down only starts drag/tap tracking.
    if (isCoarsePointer(event) && isTouchSeedShapeTool(tool)) {
      if (
        refs.touchShapePhaseRef.current !== 'placing_p1' &&
        refs.touchShapePhaseRef.current !== 'placing_p2'
      ) {
        seedTouchShapeDraft({
          handle,
          candles: refs.candlesRef.current,
          draftRef: refs.draftRef,
          touchShapePhaseRef: refs.touchShapePhaseRef,
          setShapeDraft: refs.setShapeDraftRef.current,
        })
      }
      const active = activeTouchShapePoint()
      const screen = active ? drawingPointToScreen(active) : null
      if (active && screen) {
        touchDragOrigin = {
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: screen.x,
          screenY: screen.y,
          point: active,
        }
      }
      refs.skipNextClickRef.current = true
    }
  }

  const onDrawOverlayPointerMove = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    event.preventDefault()
    const point = localPoint(event)
    const tool = refs.drawToolRef.current

    if (tool && isPolylineArrowKind(tool)) {
      const pts = refs.polylineDraftRef.current
      if (pts.length === 0) return
      const hover = clickToPoint(handle, point, refs.candlesRef.current)
      if (!hover) return
      setPolylineDraft(pts, hover)
      return
    }

    if (isCoarsePointer(event) && isTouchSeedShapeTool(tool) && refs.draftRef.current) {
      const tap = refs.tapStartRef.current
      if (!tap || tap.pointerId !== event.pointerId) return
      const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y)
      if (moved <= TAP_MOVE_THRESHOLD_PX) return
      refs.didDragRef.current = true
      const origin = touchDragOrigin
      if (!origin) return
      const mapped = clickToPoint(
        handle,
        {
          x: origin.screenX + (event.clientX - origin.clientX),
          y: origin.screenY + (event.clientY - origin.clientY),
        },
        refs.candlesRef.current,
      )
      if (
        !mapped ||
        !Number.isFinite(mapped.time) ||
        !Number.isFinite(mapped.price) ||
        mapped.time <= 0
      ) {
        return
      }
      const phase = refs.touchShapePhaseRef.current
      if (phase === 'placing_p1') {
        refs.draftRef.current = mapped
        scheduleShapeDraft(mapped, null)
      } else if (phase === 'placing_p2') {
        scheduleShapeDraft(refs.draftRef.current, mapped)
      }
      return
    }

    if (refs.draftRef.current) {
      if (tool && isShapeDrawTool(tool) && !shapePreviewFollowsPointer(event)) return
      updateDraftPreview({ point })
    }
  }

  const onDrawOverlayPointerUp = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    flushDraftRaf()
    chartRectCache = null
    touchDragOrigin = null

    const shapeTool = refs.drawToolRef.current
    if (isTouchSeedShapeTool(shapeTool) && isCoarsePointer(event)) {
      const tap = refs.tapStartRef.current
      const dragged = refs.didDragRef.current
      releaseCapture(event)
      refs.tapStartRef.current = null
      refs.didDragRef.current = false
      refs.skipNextClickRef.current = true

      const moved =
        tap != null ? Math.hypot(event.clientX - tap.x, event.clientY - tap.y) : Infinity
      if (!dragged && moved <= TAP_MOVE_THRESHOLD_PX) {
        confirmTouchShapePoint()
      }
      return
    }

    releaseCapture(event)

    const tap = refs.tapStartRef.current
    refs.tapStartRef.current = null
    if (!tap || tap.pointerId !== event.pointerId) return

    const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y)
    const tool = refs.drawToolRef.current
    if (tool && isPolylineArrowKind(tool)) {
      refs.skipNextClickRef.current = true
      handleChartTap(localPoint(event), event.clientX, event.clientY)
      syncInteractionLock()
      return
    }
    if (moved > TAP_MOVE_THRESHOLD_PX) return

    refs.skipNextClickRef.current = true
    handleChartTap(localPoint(event), event.clientX, event.clientY)
    syncInteractionLock()
  }

  const onDrawOverlayPointerCancel = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
    flushDraftRaf()
    chartRectCache = null
    touchDragOrigin = null
    refs.tapStartRef.current = null
    refs.didDragRef.current = false
    refs.touchShapeDragStartRef.current = null
    releaseCapture(event)
  }

  const onChartPointerDown = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    applyPointerHitBoost(event)
    refs.tapStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }

    syncDrawingHitGeometry()
    const point = localPoint(event)
    const iconHit = handle.icons.hitTest(point.x, point.y)
    if (iconHit?.externalId && !iconHit.externalId.startsWith('temp-')) {
      selectDrawing(iconHit.externalId)
      refs.iconPressRef.current = {
        id: iconHit.externalId,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      }
      return
    }
    const textHit = handle.textAnchors.hitTest(point.x, point.y)
    if (textHit?.externalId && !textHit.externalId.startsWith('temp-')) {
      selectDrawing(textHit.externalId)
      refs.iconPressRef.current = {
        id: textHit.externalId,
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      }
      return
    }

    const selectedId = refs.selectedIdRef.current
    if (!selectedId || selectedId.startsWith('temp-')) return
    const extension = handle.fibonacciExtensions.getDrawing(selectedId)
    if (extension?.p3) {
      const anchor = handle.fibonacciExtensions.hitTestExtensionAnchor(point.x, point.y)
      const hit = handle.fibonacciExtensions.hitTest(point.x, point.y)
      if (anchor?.id === selectedId || hit?.externalId === selectedId) {
        const origin = clickToPoint(handle, point, refs.candlesRef.current)
        if (!origin) return
        event.preventDefault()
        refs.polylineDragRef.current = {
          id: selectedId,
          vertexIndex: anchor?.id === selectedId ? anchor.vertexIndex : -1,
          moveOrigin: origin,
          points: [extension.p1, extension.p2, extension.p3].map((p) => ({ ...p })),
        }
        setCapture(event, chartEl)
        syncInteractionLock()
        return
      }
    }
    const polyAnchor = handle.polylines.hitTestAnchor(point.x, point.y)
    if (polyAnchor && polyAnchor.id === selectedId) {
      const poly = handle.polylines.getDrawing(selectedId)
      if (poly && poly.points.length >= 2) {
        event.preventDefault()
        refs.polylineDragRef.current = {
          id: selectedId,
          vertexIndex: polyAnchor.vertexIndex,
          points: poly.points.map((p) => ({ ...p })),
        }
        setCapture(event, chartEl)
        syncInteractionLock()
        return
      }
    }

    const anchor =
      handle.trendlines.hitTestAnchor(point.x, point.y) ??
      handle.rectangles.hitTestAnchor(point.x, point.y) ??
      handle.fibonacciRanges.hitTestAnchor(point.x, point.y) ??
      handle.warningCircles.hitTestAnchor(point.x, point.y) ??
      handle.icons.hitTestAnchor(point.x, point.y) ??
      handle.textAnchors.hitTestAnchor(point.x, point.y)
    if (!anchor && handle.fibonacciRanges.getDrawing(selectedId) &&
        handle.fibonacciRanges.hitTest(point.x, point.y)?.externalId === selectedId) {
      const points = drawingPoints(selectedId)
      const origin = clickToPoint(handle, point, refs.candlesRef.current)
      if (!points || !origin) return
      event.preventDefault()
      refs.dragRef.current = { id: selectedId, endpoint: 'p1', ...points, moveWhole: true, moveOrigin: origin }
      setCapture(event, chartEl)
      syncInteractionLock()
      return
    }
    if (!anchor || anchor.id !== selectedId) return
    const points = drawingPoints(anchor.id)
    if (!points) return
    const moveWhole =
      handle.icons.getDrawing(anchor.id) != null ||
      handle.textAnchors.getDrawing(anchor.id) != null
    event.preventDefault()
    refs.dragRef.current = {
      id: anchor.id,
      endpoint: anchor.endpoint,
      p1: points.p1,
      p2: points.p2,
      moveWhole,
    }
    setCapture(event, chartEl)
    syncInteractionLock()
  }

  const onChartPointerMove = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    const point = localPoint(event)
    const press = refs.iconPressRef.current
    if (!refs.dragRef.current && press && press.pointerId === event.pointerId) {
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y)
      if (moved > TAP_MOVE_THRESHOLD_PX) {
        const points = drawingPoints(press.id)
        if (points) {
          refs.didDragRef.current = true
          refs.dragRef.current = {
            id: press.id,
            endpoint: 'p1',
            p1: points.p1,
            p2: points.p2,
            moveWhole: true,
          }
          refs.iconPressRef.current = null
          setCapture(event, chartEl)
          syncInteractionLock()
        }
      }
    }

    const polyDrag = refs.polylineDragRef.current
    if (polyDrag) {
      const next = clickToPoint(handle, point, refs.candlesRef.current)
      if (!next) return
      refs.didDragRef.current = true
      const points = polyDrag.points.map((p) => ({ ...p }))
      if (polyDrag.vertexIndex === -1 && polyDrag.moveOrigin) {
        const dt = next.time - polyDrag.moveOrigin.time
        const dp = next.price - polyDrag.moveOrigin.price
        for (const p of points) {
          p.time += dt
          p.price += dp
        }
        polyDrag.moveOrigin = next
      } else {
        points[polyDrag.vertexIndex] = next
      }
      polyDrag.points = points
      refs.onPolylineChangeRef.current?.(polyDrag.id, points)
      return
    }

    const drag = refs.dragRef.current
    if (drag) {
      const next = clickToPoint(handle, point, refs.candlesRef.current)
      if (!next) return
      refs.didDragRef.current = true
      if (drag.moveWhole && drag.moveOrigin) {
        const dt = next.time - drag.moveOrigin.time
        const dp = next.price - drag.moveOrigin.price
        const p1 = { time: drag.p1.time + dt, price: drag.p1.price + dp }
        const p2 = { time: drag.p2.time + dt, price: drag.p2.price + dp }
        drag.moveOrigin = next
        drag.p1 = p1
        drag.p2 = p2
        refs.onChangeRef.current?.(drag.id, p1, p2)
      } else if (drag.moveWhole) {
        drag.p1 = next
        drag.p2 = next
        refs.onChangeRef.current?.(drag.id, next, next)
      } else if (
        drag.endpoint === 'p1' &&
        handle.warningCircles.getDrawing(drag.id) != null
      ) {
        // Move center; keep rim offset so radius stays stable in data space.
        const dTime = next.time - drag.p1.time
        const dPrice = next.price - drag.p1.price
        const p1 = next
        const p2 = { time: drag.p2.time + dTime, price: drag.p2.price + dPrice }
        drag.p1 = p1
        drag.p2 = p2
        refs.onChangeRef.current?.(drag.id, p1, p2)
      } else {
        const p1 = drag.endpoint === 'p1' ? next : drag.p1
        const p2 = drag.endpoint === 'p2' ? next : drag.p2
        drag.p1 = p1
        drag.p2 = p2
        refs.onChangeRef.current?.(drag.id, p1, p2)
      }
    }
  }

  const onChartPointerUp = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    refs.iconPressRef.current = null
    const polyDrag = refs.polylineDragRef.current
    if (polyDrag) {
      const id = polyDrag.id
      refs.polylineDragRef.current = null
      releaseCapture(event)
      syncInteractionLock()
      refs.onPolylineChangeEndRef.current?.(id)
      refs.tapStartRef.current = null
      return
    }
    const drag = refs.dragRef.current
    if (drag) {
      const id = drag.id
      refs.dragRef.current = null
      releaseCapture(event)
      syncInteractionLock()
      refs.onChangeEndRef.current?.(id)
      refs.tapStartRef.current = null
      return
    }

    releaseCapture(event)

    const tap = refs.tapStartRef.current
    refs.tapStartRef.current = null
    if (!tap || tap.pointerId !== event.pointerId) return

    const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y)
    if (moved > TAP_MOVE_THRESHOLD_PX) return

    refs.skipNextClickRef.current = true
    handleChartTap(localPoint(event), event.clientX, event.clientY)
    syncInteractionLock()
  }

  const onDoubleClick = (event: MouseEvent) => {
    if (refs.drawToolRef.current) return
    const target = event.target as HTMLElement | null
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return
    }
    syncDrawingHitGeometry()
    const point = localPoint(event as unknown as PointerEvent)
    const polyHit = handle.polylines.hitTest(point.x, point.y)
    const textHit = handle.textAnchors.hitTest(point.x, point.y)
    const circleHit = handle.warningCircles.hitTest(point.x, point.y)
    const labelHit = polyHit?.externalId ?? textHit?.externalId ?? circleHit?.externalId
    if (!labelHit) return
    event.preventDefault()
    selectDrawing(labelHit)
    refs.onPolylineLabelEditRef.current?.(labelHit)
  }

  const onChartPointerCancel = (event: PointerEvent) => {
    if (refs.drawToolRef.current) return
    refs.tapStartRef.current = null
    refs.iconPressRef.current = null
    if (refs.polylineDragRef.current) {
      const id = refs.polylineDragRef.current.id
      refs.polylineDragRef.current = null
      releaseCapture(event)
      syncInteractionLock()
      refs.onPolylineChangeEndRef.current?.(id)
      return
    }
    if (!refs.dragRef.current) {
      releaseCapture(event)
      syncInteractionLock()
      return
    }
    const id = refs.dragRef.current.id
    refs.dragRef.current = null
    releaseCapture(event)
    syncInteractionLock()
    refs.onChangeEndRef.current?.(id)
  }

  const pointerOpts: AddEventListenerOptions = { passive: false }
  chartEl.addEventListener('pointerdown', onChartPointerDown, pointerOpts)
  chartEl.addEventListener('pointermove', onChartPointerMove, pointerOpts)
  chartEl.addEventListener('pointerup', onChartPointerUp, pointerOpts)
  chartEl.addEventListener('pointercancel', onChartPointerCancel, pointerOpts)
  chartEl.addEventListener('dblclick', onDoubleClick)
  if (overlayEl) {
    overlayEl.addEventListener('pointerdown', onDrawOverlayPointerDown, pointerOpts)
    overlayEl.addEventListener('pointermove', onDrawOverlayPointerMove, pointerOpts)
    overlayEl.addEventListener('pointerup', onDrawOverlayPointerUp, pointerOpts)
    overlayEl.addEventListener('pointercancel', onDrawOverlayPointerCancel, pointerOpts)
  }
  syncDrawOverlay()

  return () => {
    flushDraftRaf()
    touchDragOrigin = null
    chartRectCache = null
    refs.chartElRef.current = null
    refs.pointerCaptureElRef.current = null
    chartEl.removeEventListener('pointerdown', onChartPointerDown, pointerOpts)
    chartEl.removeEventListener('pointermove', onChartPointerMove, pointerOpts)
    chartEl.removeEventListener('pointerup', onChartPointerUp, pointerOpts)
    chartEl.removeEventListener('pointercancel', onChartPointerCancel, pointerOpts)
    chartEl.removeEventListener('dblclick', onDoubleClick)
    if (overlayEl) {
      overlayEl.removeEventListener('pointerdown', onDrawOverlayPointerDown, pointerOpts)
      overlayEl.removeEventListener('pointermove', onDrawOverlayPointerMove, pointerOpts)
      overlayEl.removeEventListener('pointerup', onDrawOverlayPointerUp, pointerOpts)
      overlayEl.removeEventListener('pointercancel', onDrawOverlayPointerCancel, pointerOpts)
    }
  }
}
