import { pipe } from './pipe'

// This file is checked by tsc; it is not a runtime test.
pipe(
  (value: number) => String(value),
  (value: string) => value.length,
  (value: number) => value > 0,
)

// @ts-expect-error The second stage cannot accept the first stage's string output.
pipe((value: number) => String(value), (value: boolean) => value, (value: boolean) => value)
