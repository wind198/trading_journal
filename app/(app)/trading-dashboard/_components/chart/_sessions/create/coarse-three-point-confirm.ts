import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'

export type CoarseThreePointPhaseState =
  | { phase: 'idle' }
  | { phase: 'placing_p1'; p1: DrawingPoint }
  | { phase: 'placing_p2'; p1: DrawingPoint; p2: DrawingPoint }
  | { phase: 'placing_p3'; p1: DrawingPoint; p2: DrawingPoint; p3: DrawingPoint }

export type CoarseThreePointDecision =
  | { kind: 'ignore' }
  | { kind: 'place_second'; p1: DrawingPoint; p2: DrawingPoint }
  | { kind: 'place_third'; p1: DrawingPoint; p2: DrawingPoint; p3: DrawingPoint }
  | { kind: 'complete'; p1: DrawingPoint; p2: DrawingPoint; p3: DrawingPoint }

/** Pure confirm transition for coarse three-point create. */
export function decideCoarseThreePointConfirm(
  state: CoarseThreePointPhaseState,
  defaultPoint: DrawingPoint | null,
): CoarseThreePointDecision {
  if (state.phase === 'idle') return { kind: 'ignore' }
  if (state.phase === 'placing_p3') {
    return { kind: 'complete', p1: state.p1, p2: state.p2, p3: state.p3 }
  }
  if (!defaultPoint) return { kind: 'ignore' }
  if (state.phase === 'placing_p2') {
    return { kind: 'place_third', p1: state.p1, p2: state.p2, p3: defaultPoint }
  }
  return { kind: 'place_second', p1: state.p1, p2: defaultPoint }
}
