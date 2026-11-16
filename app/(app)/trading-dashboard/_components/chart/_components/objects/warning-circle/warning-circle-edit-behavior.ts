import type { ChartHandle } from '../../../price-chart-handle'
import type { WarningCircleDrawing } from './warning-circle-primitive'
import { anchorSession, type EditProbe, type ScreenPoint, type ToolEditBehavior } from '../../../_sessions/edit/edit-contract'

export class WarningCircleEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['warningCircles'], private readonly drawings: () => readonly WarningCircleDrawing[]) {}
  beginAnchor(id: string, screen: ScreenPoint): EditProbe {
    const hit = this.primitive.hitTestAnchor(screen.x, screen.y)
    if (!hit) return null
    if (hit.id !== id) return 'blocked'
    const drawing = this.drawings().find((item) => item.id === id) ?? this.primitive.getDrawing(id)
    if (!drawing) return null
    if (hit.endpoint === 'p2') return anchorSession(id, drawing, 'p2')
    let { p1, p2 } = drawing
    return {
      id, changeKind: 'two-point',
      move(point) {
        const dt = point.time - p1.time
        const dp = point.price - p1.price
        p1 = point
        p2 = { time: p2.time + dt, price: p2.price + dp }
        return { kind: 'two-point', id, p1, p2 }
      },
    }
  }
}
