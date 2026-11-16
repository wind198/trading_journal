import { createChartInteractionComposition, type PriceChartInteractionHelpers, type PriceChartInteractionRefs } from './chart-interaction-composition'
import { PriceChartInteractionMediator } from './price-chart-interaction-mediator'
import type { ChartHandle } from './price-chart-handle'

export { isShapeDrawTool, isTouchSeedShapeTool, isTwoPointDrawTool, defaultShapePreviewP2 } from './chart-interaction-composition'
export type { PriceChartInteractionRefs, PriceChartInteractionHelpers } from './chart-interaction-composition'

/** Compatibility entry point: compose behaviors, then give their events to the mediator. */
export function bindPriceChartInteraction(input: {
  handle: ChartHandle
  chartEl: HTMLElement
  overlayEl: HTMLElement | null
  refs: PriceChartInteractionRefs
  helpers: PriceChartInteractionHelpers
}): () => void {
  const composition = createChartInteractionComposition(input)
  const mediator = new PriceChartInteractionMediator(input.handle.chart, input.chartEl, input.overlayEl, composition.handlers)
  mediator.start()
  composition.start()
  return () => {
    mediator.dispose()
    composition.dispose()
  }
}
