import type { ChartHandle } from '../../../price-chart-handle'
import type { TextAnchorDrawing } from './text-anchor-primitive'
import { onePointSession, type EditProbe, type ScreenPoint, type ToolEditBehavior, type ToolEditSession } from '../../../_sessions/edit/edit-contract'

export class TextAnchorEditBehavior implements ToolEditBehavior {
  constructor(private readonly primitive: ChartHandle['textAnchors'], private readonly drawings: () => readonly TextAnchorDrawing[]) {}
  relativePressAnchor(id: string) {
    return (this.drawings().find(item => item.id === id) ?? this.primitive.getDrawing(id))?.p1 ?? null
  }
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
