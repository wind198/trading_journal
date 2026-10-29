export type Regime = 'choppy' | 'trending'
export type BiasValue = -1 | 0 | 1

/** Bias 0 = choppy; ±1 = trending. */
export function regimeFromBias(value: BiasValue | null): Regime | null {
  if (value == null) return null
  return value === 0 ? 'choppy' : 'trending'
}
