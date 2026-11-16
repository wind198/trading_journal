import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
import type { ChartHandle } from '../../../price-chart-handle'
import type { FibonacciRangeDrawing } from './fibonacci-range-primitive'
import { anchorProbe, translatedPairSession, type EditProbe, type Pair, type ScreenPoint, type ToolEditBehavior, type ToolEditSession } from '../../../_sessions/edit/edit-contract'

export class FibonacciRangeEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['fibonacciRanges'], private readonly drawings: () => readonly FibonacciRangeDrawing[]) {}
  private drawing(id: string): Pair | null {
    return this.drawings().find((item) => item.id === id) ?? this.primitive.getDrawing(id)
  }
  beginAnchor(id: string, screen: ScreenPoint): EditProbe {
    return anchorProbe(this.primitive.hitTestAnchor(screen.x, screen.y), id, this.drawing(id))
  }
  beginBody(id: string, screen: ScreenPoint, chartPoint: DrawingPoint | null): ToolEditSession | null {
    if (!this.primitive.getDrawing(id) || this.primitive.hitTest(screen.x, screen.y)?.externalId !== id) return null
    const drawing = this.drawing(id)
    return drawing && chartPoint ? translatedPairSession(id, drawing, chartPoint) : null
  }
}
