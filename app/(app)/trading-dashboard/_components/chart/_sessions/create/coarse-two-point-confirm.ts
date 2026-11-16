import type { DrawingPoint } from '../../../../_lib/chart/chart-drawings'

export type CoarseTwoPointPhaseState =
  | { phase: 'idle' }
  | { phase: 'placing_p1'; p1: DrawingPoint }
  | { phase: 'placing_p2'; p1: DrawingPoint; p2: DrawingPoint }

export type CoarseConfirmDecision =
  | { kind: 'ignore' }
  | { kind: 'place_second'; p1: DrawingPoint; p2: DrawingPoint }
  | { kind: 'complete'; p1: DrawingPoint; p2: DrawingPoint }

/** Pure confirm transition for coarse two-point create. */
export function decideCoarseTwoPointConfirm(
  state: CoarseTwoPointPhaseState,
  defaultP2: DrawingPoint | null,
): CoarseConfirmDecision {
  if (state.phase === 'idle') return { kind: 'ignore' }
  if (state.phase === 'placing_p2') return { kind: 'complete', p1: state.p1, p2: state.p2 }
  if (!defaultP2) return { kind: 'ignore' }
  return { kind: 'place_second', p1: state.p1, p2: defaultP2 }
}
