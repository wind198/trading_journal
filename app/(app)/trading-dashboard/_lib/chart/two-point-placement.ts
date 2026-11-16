import type { DrawingPoint } from './chart-drawings'

/** Pure placement decision shared by fine-pointer, two-point drawing tools. */
export type TwoPointPlacement =
  | { kind: 'ignore' }
  | { kind: 'start'; p1: DrawingPoint }
  | { kind: 'complete'; p1: DrawingPoint; p2: DrawingPoint }

export function decideTwoPointTap(
  currentP1: DrawingPoint | null,
  mappedPoint: DrawingPoint | null,
): TwoPointPlacement {
  if (!mappedPoint) return { kind: 'ignore' }
  if (!currentP1) return { kind: 'start', p1: mappedPoint }
  return { kind: 'complete', p1: currentP1, p2: mappedPoint }
}
