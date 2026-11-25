import type { ChartHandle } from '../../price-chart-handle'
import type { TrendlineDrawing } from '../../_components/objects/trendline/trendline-primitive'
import type { RectangleDrawing } from '../../_components/objects/rect/rectangle-primitive'
import type { FibonacciRangeDrawing } from '../../_components/objects/fibonacci-range/fibonacci-range-primitive'
import type { WarningCircleDrawing } from '../../_components/objects/warning-circle/warning-circle-primitive'
import type { IconMarkerDrawing } from '../../_components/objects/icon/icon-marker-primitive'
import type { TextAnchorDrawing } from '../../_components/objects/text/text-anchor-primitive'
import type { AnchorEditPhase, ToolEditBehavior } from './edit-contract'
import { legacyAnchors } from './edit-contract'
import { TrendlineEditBehavior } from '../../_components/objects/trendline/trendline-edit-behavior'
import { RectangleEditBehavior } from '../../_components/objects/rect/rectangle-edit-behavior'
import { FibonacciRangeEditBehavior } from '../../_components/objects/fibonacci-range/fibonacci-range-edit-behavior'
import { WarningCircleEditBehavior } from '../../_components/objects/warning-circle/warning-circle-edit-behavior'
import { IconEditBehavior } from '../../_components/objects/icon/icon-edit-behavior'
import { TextAnchorEditBehavior } from '../../_components/objects/text/text-anchor-edit-behavior'
import { FibonacciExtensionEditBehavior } from '../../_components/objects/fibonacci-extension/fibonacci-extension-edit-behavior'
import { ParallelChannelEditBehavior } from '../../_components/objects/parallel-channel/parallel-channel-edit-behavior'
import { PolylineEditBehavior } from '../../_components/objects/polyline/polyline-edit-behavior'

export type EditToolSet = {
  press: ToolEditBehavior[]
  primary: ToolEditBehavior[]
  anchors: AnchorEditPhase[]
  body: ToolEditBehavior[]
}

export type EditDrawingCollections = {
  trendlines: readonly TrendlineDrawing[]
  rectangles: readonly RectangleDrawing[]
  fibonacciRanges: readonly FibonacciRangeDrawing[]
  warningCircles: readonly WarningCircleDrawing[]
  icons: readonly IconMarkerDrawing[]
  textAnchors: readonly TextAnchorDrawing[]
}

/** Preserves the old hit order explicitly while giving each tool its own edit rules. */
export function createToolEditBehaviors(handle: ChartHandle, drawings: () => EditDrawingCollections): EditToolSet {
  const trendline = new TrendlineEditBehavior(handle.trendlines, () => drawings().trendlines)
  const rectangle = new RectangleEditBehavior(handle.rectangles, () => drawings().rectangles)
  const range = new FibonacciRangeEditBehavior(handle.fibonacciRanges, () => drawings().fibonacciRanges)
  const circle = new WarningCircleEditBehavior(handle.warningCircles, () => drawings().warningCircles)
  const icon = new IconEditBehavior(handle.icons, () => drawings().icons)
  const text = new TextAnchorEditBehavior(handle.textAnchors, () => drawings().textAnchors)
  const extension = new FibonacciExtensionEditBehavior(handle.fibonacciExtensions)
  const polyline = new PolylineEditBehavior(handle.polylines)
  return {
    press: [icon, text],
    primary: [...(handle.parallelChannels?[new ParallelChannelEditBehavior(handle.parallelChannels)]:[]),extension, polyline],
    anchors: legacyAnchors([trendline, rectangle, range, circle, icon, text]),
    body: [range],
  }
}

/**
 * Legacy press/primary/body plus remaining anchors after store-backed trendline+rectangle.
 * Used by ChartEditRuntime while those two scopes own store AnchorEditPhases.
 */
export function createLegacyEditPartsWithoutTwoPointStoreAnchors(
  handle: ChartHandle,
  drawings: () => EditDrawingCollections,
): Omit<EditToolSet, 'anchors'> & { afterTwoPointStoreAnchors: ToolEditBehavior[] } {
  const range = new FibonacciRangeEditBehavior(handle.fibonacciRanges, () => drawings().fibonacciRanges)
  const circle = new WarningCircleEditBehavior(handle.warningCircles, () => drawings().warningCircles)
  const icon = new IconEditBehavior(handle.icons, () => drawings().icons)
  const text = new TextAnchorEditBehavior(handle.textAnchors, () => drawings().textAnchors)
  const extension = new FibonacciExtensionEditBehavior(handle.fibonacciExtensions)
  const polyline = new PolylineEditBehavior(handle.polylines)
  return {
    press: [icon, text],
    primary: [...(handle.parallelChannels?[new ParallelChannelEditBehavior(handle.parallelChannels)]:[]),extension, polyline],
    afterTwoPointStoreAnchors: [range, circle, icon, text],
    body: [range],
  }
}
