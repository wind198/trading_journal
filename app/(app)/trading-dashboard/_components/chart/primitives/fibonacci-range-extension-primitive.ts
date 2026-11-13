import { FibonacciRangePrimitive } from './fibonacci-range-primitive'
import type { DrawingPoint } from '../../../_lib/chart/chart-drawings'

export type FibonacciRangeExtensionDrawing = {
  id: string
  points: [DrawingPoint, DrawingPoint, DrawingPoint]
}

/** Three-anchor projection: C + ratio × (B − A). */
export class FibonacciRangeExtensionPrimitive extends FibonacciRangePrimitive {
  constructor() {
    super([], true)
  }

  setExtensions(drawings: readonly FibonacciRangeExtensionDrawing[]): void {
    this.setRanges(drawings.map(({ id, points }) => ({ id, p1: points[0], p2: points[1], p3: points[2] })))
  }
}
