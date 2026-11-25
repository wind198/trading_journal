import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'

export type ScreenPoint = { x: number; y: number }
export type EditChange =
  | { kind: 'two-point'; id: string; p1: DrawingPoint; p2: DrawingPoint }
  | { kind: 'polyline'; id: string; points: DrawingPoint[] }

export type ToolEditSession = {
  id: string
  changeKind: EditChange['kind']
  relativeAnchor?: DrawingPoint
  move: (point: DrawingPoint) => EditChange
}

export type EditProbe = ToolEditSession | 'blocked' | null

/** Each tool owns its hit rules; the coordinator invokes phases in the existing priority order. */
export interface ToolEditBehavior {
  relativePressAnchor?(id: string): DrawingPoint | null
  pressHit?(screen: ScreenPoint): string | null
  beginPress?(id: string): ToolEditSession | null
  beginPrimary?(id: string, screen: ScreenPoint, chartPoint: DrawingPoint | null): ToolEditSession | null
  beginAnchor?(id: string, screen: ScreenPoint): EditProbe
  beginBody?(id: string, screen: ScreenPoint, chartPoint: DrawingPoint | null): ToolEditSession | null
}

/** Store-backed anchor begin keeps hit-order while InteractionStore owns the drag. */
export type StoreAnchorBegin =
  | { scopeId: string; input: unknown }
  | 'blocked'
  | null

export type AnchorEditPhase =
  | { kind: 'legacy'; behavior: ToolEditBehavior }
  | { kind: 'store'; beginAnchor: (id: string, screen: ScreenPoint) => StoreAnchorBegin }

export type Pair = { p1: DrawingPoint; p2: DrawingPoint }
export type Endpoint = 'p1' | 'p2'

export function anchorSession(id: string, pair: Pair, endpoint: Endpoint): ToolEditSession {
  let { p1, p2 } = pair
  return {
    id, changeKind: 'two-point',
    move(point) {
      if (endpoint === 'p1') p1 = point
      else p2 = point
      return { kind: 'two-point', id, p1, p2 }
    },
  }
}

export function onePointSession(id: string): ToolEditSession {
  return {
    id, changeKind: 'two-point',
    move(point) { return { kind: 'two-point', id, p1: point, p2: point } },
  }
}

export function translatedPairSession(id: string, pair: Pair, origin: DrawingPoint): ToolEditSession {
  let { p1, p2 } = pair
  let previous = origin
  return {
    id, changeKind: 'two-point',
    move(point) {
      const dt = point.time - previous.time
      const dp = point.price - previous.price
      p1 = { time: p1.time + dt, price: p1.price + dp }
      p2 = { time: p2.time + dt, price: p2.price + dp }
      previous = point
      return { kind: 'two-point', id, p1, p2 }
    },
  }
}

export function anchorProbe(
  hit: { id: string; endpoint: Endpoint } | null,
  id: string,
  drawing: Pair | null,
): EditProbe {
  if (!hit) return null
  if (hit.id !== id) return 'blocked'
  return drawing ? anchorSession(id, drawing, hit.endpoint) : null
}

export function legacyAnchors(behaviors: ToolEditBehavior[]): AnchorEditPhase[] {
  return behaviors.map((behavior) => ({ kind: 'legacy' as const, behavior }))
}
