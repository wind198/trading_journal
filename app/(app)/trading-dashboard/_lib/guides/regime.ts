export type Regime = 'choppy' | 'uptrend' | 'downtrend'
export type BiasValue = -1 | 0 | 1

/** Bias 0 = choppy; 1 = uptrend; -1 = downtrend. */
export function regimeFromBias(value: BiasValue | null): Regime | null {
  if (value == null) return null
  if (value === 0) return 'choppy'
  return value === 1 ? 'uptrend' : 'downtrend'
}
