/** Compose three synchronous transformations in declaration order. */
export function pipe<A, B, C, D>(
  first: (input: A) => B,
  second: (input: B) => C,
  third: (input: C) => D,
): (input: A) => D {
  return (input) => third(second(first(input)))
}

/** Mark a side effect in a pipeline while passing its input through unchanged. */
export function effect<T>(run: (input: T) => void): (input: T) => T {
  return (input) => {
    run(input)
    return input
  }
}
