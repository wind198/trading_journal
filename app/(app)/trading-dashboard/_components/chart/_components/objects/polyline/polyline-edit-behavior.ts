import type { ChartHandle } from '../../../price-chart-handle'
import type { ScreenPoint, ToolEditBehavior, ToolEditSession } from '../../../_sessions/edit/edit-contract'

export class PolylineEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['polylines']) {}
  beginPrimary(id: string, screen: ScreenPoint): ToolEditSession | null {
    const anchor = this.primitive.hitTestAnchor(screen.x, screen.y)
    if (anchor?.id !== id) return null
    const drawing = this.primitive.getDrawing(id)
    if (!drawing || drawing.points.length < 2) return null
    let points = drawing.points.map((point) => ({ ...point }))
    return {
      id, changeKind: 'polyline',
      move(point) {
        points = points.map((current) => ({ ...current }))
        points[anchor.vertexIndex] = point
        return { kind: 'polyline', id, points }
      },
    }
  }
}
