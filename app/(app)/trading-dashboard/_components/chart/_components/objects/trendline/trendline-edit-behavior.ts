import type { ChartHandle } from '../../../price-chart-handle'
import type { TrendlineDrawing } from './trendline-primitive'
import { anchorProbe, type EditProbe, type ScreenPoint, type ToolEditBehavior } from '../../../_sessions/edit/edit-contract'

export class TrendlineEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['trendlines'], private readonly drawings: () => readonly TrendlineDrawing[]) {}
  beginAnchor(id: string, screen: ScreenPoint): EditProbe {
    const hit = this.primitive.hitTestAnchor(screen.x, screen.y)
    const drawing = this.drawings().find((item) => item.id === id) ?? this.primitive.getDrawing(id)
    return anchorProbe(hit, id, drawing)
  }
}
