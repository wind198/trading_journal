import type { RefObject } from 'react'
import {
  isPolylineArrowKind,
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../_lib/chart/chart-drawings'
import { isChartIconKind } from '../../_lib/chart/chart-icons'
import { barIntervalSec, type BarTimeSeries } from '../../_lib/chart/chart-coordinates'
import type { IconMarkerDrawing } from './primitives/icon-marker-primitive'
import type { RectangleDrawing } from './primitives/rectangle-primitive'
import type { TrendlineDrawing } from './primitives/trendline-primitive'
import { clickToPoint, type ChartHandle } from './price-chart-handle'

const TAP_MOVE_THRESHOLD_PX = 12
const TOUCH_HIT_BOOST = 1.75
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 24

type ShapeDrawTool = 'trendline' | 'rectangle'
export type TouchShapePhase = 'idle' | 'has_p1' | 'preview_drag'

export function isShapeDrawTool(tool: ChartDrawingKind | null): tool is ShapeDrawTool {
  return tool === 'trendline' || tool === 'rectangle'
}

function defaultShapePreviewP2(
  p1: DrawingPoint,
  bars: readonly { time: number }[],
): DrawingPoint {
  const dt = barIntervalSec(bars) ?? 60
  return { time: p1.time + dt, price: p1.price }
}

export type DrawingDragState = {
  id: string
  endpoint: 'p1' | 'p2'
  p1: DrawingPoint
  p2: DrawingPoint
  moveWhole: boolean
}

export type PolylineDragState = {
  id: string
  vertexIndex: number
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
  shapeP1GestureRef: RefObject<boolean>
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
  iconsRef: RefObject<readonly IconMarkerDrawing[]>
  setShapeAwaitingP2Ref: RefObject<(value: boolean) => void>
  setShapeDraftRef: RefObject<(p1: DrawingPoint, p2?: DrawingPoint) => void>
  onCompleteRef: RefObject<
    | ((input: { kind: ChartDrawingKind; p1: DrawingPoint; p2: DrawingPoint }) => void)
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
  setShapeDraft: (p1: DrawingPoint, p2?: DrawingPoint) => void
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

  const syncDrawingHitGeometry = () => {
    handle.trendlines.updateAllViews()
    handle.rectangles.updateAllViews()
    handle.icons.updateAllViews()
    handle.polylines.updateAllViews()
  }

  const drawingPoints = (id: string): { p1: DrawingPoint; p2: DrawingPoint } | null => {
    const fromTrend = refs.trendlinesRef.current.find((d) => d.id === id)
    if (fromTrend) return { p1: fromTrend.p1, p2: fromTrend.p2 }
    const fromRect = refs.rectanglesRef.current.find((d) => d.id === id)
    if (fromRect) return { p1: fromRect.p1, p2: fromRect.p2 }
    const fromIcon = refs.iconsRef.current.find((d) => d.id === id)
    if (fromIcon) return { p1: fromIcon.p1, p2: fromIcon.p1 }
    const line = handle.trendlines.getDrawing(id)
    if (line) return { p1: line.p1, p2: line.p2 }
    const rect = handle.rectangles.getDrawing(id)
    if (rect) return { p1: rect.p1, p2: rect.p2 }
    const icon = handle.icons.getDrawing(id)
    if (icon) return { p1: icon.p1, p2: icon.p1 }
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
    handle.icons.setHitBoost(boost)
    handle.polylines.setHitBoost(boost)
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

  const handleChartTap = (
    point: { x: number; y: number },
    clientX?: number,
    clientY?: number,
  ) => {
    syncDrawingHitGeometry()
    const tool = refs.drawToolRef.current
    if (tool) {
      if (isShapeDrawTool(tool) && refs.pointerCoarseRef.current) return
      const mapped = clickToPoint(handle, point, refs.candlesRef.current)
      if (!mapped) return
      if (isChartIconKind(tool)) {
        clearDrafts()
        refs.onCompleteRef.current?.({ kind: tool, p1: mapped, p2: mapped })
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
    const iconHit = handle.icons.hitTest(point.x, point.y)
    const polyHit = handle.polylines.hitTest(point.x, point.y)
    const hit = [lineHit, rectHit, iconHit, polyHit]
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0]
    const hitId = hit?.externalId ?? null
    if (
      hitId &&
      polyHit?.externalId === hitId &&
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
    const rect = chartEl.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
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
    applyPointerHitBoost(event)
    refs.tapStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    }
    event.preventDefault()
    if (overlayEl) setCapture(event, overlayEl)
    syncInteractionLock()

    const tool = refs.drawToolRef.current
    if (tool && isPolylineArrowKind(tool)) return
    if (isCoarsePointer(event) && tool && isShapeDrawTool(tool)) {
      const mapped = clickToPoint(handle, localPoint(event), refs.candlesRef.current)
      if (!mapped) return

      if (refs.touchShapePhaseRef.current === 'idle' || !refs.draftRef.current) {
        refs.draftRef.current = mapped
        refs.touchShapePhaseRef.current = 'has_p1'
        refs.shapeP1GestureRef.current = true
        refs.setShapeDraftRef.current(
          mapped,
          defaultShapePreviewP2(mapped, refs.candlesRef.current),
        )
        refs.setShapeAwaitingP2Ref.current(true)
        refs.skipNextClickRef.current = true
        return
      }
      if (refs.touchShapePhaseRef.current === 'has_p1') {
        refs.shapeP1GestureRef.current = false
        refs.touchShapePhaseRef.current = 'preview_drag'
        refs.touchShapeDragStartRef.current = {
          x: event.clientX,
          y: event.clientY,
        }
        refs.setShapeDraftRef.current(refs.draftRef.current, mapped)
        refs.skipNextClickRef.current = true
      }
    }
  }

  const onDrawOverlayPointerMove = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return
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

    if (
      tool &&
      isShapeDrawTool(tool) &&
      isCoarsePointer(event) &&
      refs.draftRef.current &&
      (refs.touchShapePhaseRef.current === 'preview_drag' ||
        (refs.touchShapePhaseRef.current === 'has_p1' && refs.shapeP1GestureRef.current))
    ) {
      const mapped = clickToPoint(handle, point, refs.candlesRef.current)
      if (mapped) refs.setShapeDraftRef.current(refs.draftRef.current, mapped)
      return
    }

    if (refs.draftRef.current) {
      if (tool && isShapeDrawTool(tool) && !shapePreviewFollowsPointer(event)) return
      updateDraftPreview({ point })
    }
  }

  const onDrawOverlayPointerUp = (event: PointerEvent) => {
    if (!refs.drawToolRef.current) return

    const shapeTool = refs.drawToolRef.current
    const coarseShape = shapeTool && isShapeDrawTool(shapeTool) && isCoarsePointer(event)

    if (coarseShape) {
      const phase = refs.touchShapePhaseRef.current
      releaseCapture(event)
      refs.tapStartRef.current = null
      refs.skipNextClickRef.current = true

      const p1 = refs.draftRef.current
      const mappedP2 = clickToPoint(handle, localPoint(event), refs.candlesRef.current)
      const p2 = mappedP2 ?? refs.shapePreviewP2Ref.current

      if (phase === 'preview_drag' && p1 && p2) {
        refs.touchShapeDragStartRef.current = null
        refs.touchShapePhaseRef.current = 'has_p1'
        refs.setShapeDraftRef.current(p1, p2)
        syncInteractionLock()
        return
      }

      if (phase === 'has_p1' && p1 && p2) {
        if (refs.shapeP1GestureRef.current) {
          refs.shapeP1GestureRef.current = false
        }
        refs.touchShapePhaseRef.current = 'has_p1'
        refs.setShapeDraftRef.current(p1, p2)
        syncInteractionLock()
        return
      }

      syncInteractionLock()
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
    refs.tapStartRef.current = null
    if (refs.touchShapePhaseRef.current === 'preview_drag') {
      refs.touchShapePhaseRef.current = 'has_p1'
      refs.touchShapeDragStartRef.current = null
      const p1 = refs.draftRef.current
      if (p1) refs.setShapeDraftRef.current(p1)
    }
    releaseCapture(event)
    syncInteractionLock()
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

    const selectedId = refs.selectedIdRef.current
    if (!selectedId || selectedId.startsWith('temp-')) return
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
      handle.icons.hitTestAnchor(point.x, point.y)
    if (!anchor || anchor.id !== selectedId) return
    const points = drawingPoints(anchor.id)
    if (!points) return
    const moveWhole = handle.icons.getDrawing(anchor.id) != null
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
      points[polyDrag.vertexIndex] = next
      polyDrag.points = points
      refs.onPolylineChangeRef.current?.(polyDrag.id, points)
      return
    }

    const drag = refs.dragRef.current
    if (drag) {
      const next = clickToPoint(handle, point, refs.candlesRef.current)
      if (!next) return
      refs.didDragRef.current = true
      if (drag.moveWhole) {
        drag.p1 = next
        drag.p2 = next
        refs.onChangeRef.current?.(drag.id, next, next)
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
    if (!polyHit?.externalId) return
    event.preventDefault()
    selectDrawing(polyHit.externalId)
    refs.onPolylineLabelEditRef.current?.(polyHit.externalId)
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
  chartEl.addEventListener('pointermove', onChartPointerMove)
  chartEl.addEventListener('pointerup', onChartPointerUp, pointerOpts)
  chartEl.addEventListener('pointercancel', onChartPointerCancel, pointerOpts)
  chartEl.addEventListener('dblclick', onDoubleClick)
  if (overlayEl) {
    overlayEl.addEventListener('pointerdown', onDrawOverlayPointerDown, pointerOpts)
    overlayEl.addEventListener('pointermove', onDrawOverlayPointerMove)
    overlayEl.addEventListener('pointerup', onDrawOverlayPointerUp, pointerOpts)
    overlayEl.addEventListener('pointercancel', onDrawOverlayPointerCancel, pointerOpts)
  }
  syncDrawOverlay()

  return () => {
    refs.chartElRef.current = null
    refs.pointerCaptureElRef.current = null
    chartEl.removeEventListener('pointerdown', onChartPointerDown, pointerOpts)
    chartEl.removeEventListener('pointermove', onChartPointerMove)
    chartEl.removeEventListener('pointerup', onChartPointerUp, pointerOpts)
    chartEl.removeEventListener('pointercancel', onChartPointerCancel, pointerOpts)
    chartEl.removeEventListener('dblclick', onDoubleClick)
    if (overlayEl) {
      overlayEl.removeEventListener('pointerdown', onDrawOverlayPointerDown, pointerOpts)
      overlayEl.removeEventListener('pointermove', onDrawOverlayPointerMove)
      overlayEl.removeEventListener('pointerup', onDrawOverlayPointerUp, pointerOpts)
      overlayEl.removeEventListener('pointercancel', onDrawOverlayPointerCancel, pointerOpts)
    }
  }
}
