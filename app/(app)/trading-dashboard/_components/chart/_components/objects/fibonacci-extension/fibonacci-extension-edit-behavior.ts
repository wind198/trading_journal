import type { DrawingPoint } from '../../../../../_lib/chart/chart-drawings'
import type { ChartHandle } from '../../../price-chart-handle'
import type { ScreenPoint, ToolEditBehavior, ToolEditSession } from '../../../_sessions/edit/edit-contract'

export class FibonacciExtensionEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['fibonacciExtensions']) {}
  beginPrimary(id: string, screen: ScreenPoint, chartPoint: DrawingPoint | null): ToolEditSession | null {
    const drawing = this.primitive.getDrawing(id)
    if (!drawing?.p3) return null
    const anchor = this.primitive.hitTestExtensionAnchor(screen.x, screen.y)
    const hit = this.primitive.hitTest(screen.x, screen.y)
    if (anchor?.id !== id && hit?.externalId !== id) return null
    if (!chartPoint) return null
    let points = [drawing.p1, drawing.p2, drawing.p3].map((point) => ({ ...point }))
    const vertexIndex = anchor?.id === id ? anchor.vertexIndex : -1
    let origin = chartPoint
    return {
      id, changeKind: 'polyline',
      move(point) {
        points = points.map((current) => ({ ...current }))
        if (vertexIndex === -1) {
          const dt = point.time - origin.time
          const dp = point.price - origin.price
          points = points.map((current) => ({ time: current.time + dt, price: current.price + dp }))
          origin = point
        } else points[vertexIndex] = point
        return { kind: 'polyline', id, points }
      },
    }
  }
}
