import type { ChartHandle } from '../../../price-chart-handle'
import type { IconMarkerDrawing } from './icon-marker-primitive'
import { onePointSession, type EditProbe, type ScreenPoint, type ToolEditBehavior, type ToolEditSession } from '../../../_sessions/edit/edit-contract'

export class IconEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['icons'], private readonly drawings: () => readonly IconMarkerDrawing[]) {}
  pressHit(screen: ScreenPoint): string | null {
    return this.primitive.hitTest(screen.x, screen.y)?.externalId ?? null
  }
  beginPress(id: string): ToolEditSession | null {
    return this.drawings().some((item) => item.id === id) || this.primitive.getDrawing(id) ? onePointSession(id) : null
  }
  beginAnchor(id: string, screen: ScreenPoint): EditProbe {
    const hit = this.primitive.hitTestAnchor(screen.x, screen.y)
    if (!hit) return null
    if (hit.id !== id) return 'blocked'
    return this.beginPress(id)
  }
}
