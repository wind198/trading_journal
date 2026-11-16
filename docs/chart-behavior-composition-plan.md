# Chart behavior composition: incremental implementation plan

## Goal

Apply the attached Structured Behavior Composition (SBC) design to chart drawing interactions in this repository. Start with a small, measurable extraction from the existing Lightweight Charts interaction code. Preserve current user behavior while making the placement workflow easier to read and test.

The attached design describes a standalone `flow-core`, `graphics-flow`, and Canvas playground as a prototype. This repository already has a working chart, drawing primitives, and persistence. Here, the first validation uses the existing chart. The first slice includes only the generic composition primitives its workflow actually uses: a synchronous typed `pipe` and an explicit `effect` marker.

## Current baseline

- `app/(app)/trading-dashboard/_components/chart/bind-price-chart-interaction.ts` is about 965 lines and combines chart subscriptions, pointer events, placement, selection, dragging, touch behavior, and cleanup.
- `handleChartTap` contains the two point placement path shared by rectangle, trendline, Fibonacci range, and warning circle. It reads and mutates refs, updates preview, and calls the completion callback.
- `price-chart.tsx` owns preview updates and `clearDrafts`; the binding calls these through helpers. Chart coordinate conversion is already in `price-chart-handle.ts` and `chart-coordinates.ts`.
- Rectangle, trendline, Fibonacci range, and warning circle use the same two tap placement path on fine pointers. Coarse pointers have a separate seed, drag, tap confirmation path. The first slice covers **fine pointer two point placement only**.
- An existing `bind-price-chart-interaction.test.ts` provides a place to add interaction regression tests. There is an unrelated in-progress change to `fibonacci-range-primitive.ts`; leave it untouched.

## First slice: composed two point placement workflow

Compose three named stages for rectangle, trendline, Fibonacci range, and warning circle: map the chart tap to a drawing point, decide between **start draft**, **complete draft**, and **ignore invalid point**, then apply the preview or completion effect. The decision is pure and independently testable. Coordinate conversion and effects stay in the chart adapter.

```ts
const placeTwoPointDrawing = pipe(
  mapTwoPointTap,
  decideTwoPointPlacement,
  effect(applyTwoPointPlacement),
)
```

`pipe` is synchronous and preserves declaration order. A thrown error propagates unchanged and later stages do not run. `effect` runs a `void` callback and passes its input onward; it does not provide rollback or catch errors. The initial helper accepts three stages because that is the concrete workflow under evaluation. Add other arities or operators only when another real workflow needs them.

Suggested shape (illustrative, not a required API):

```ts
type TwoPointPlacement =
  | { kind: 'start'; p1: DrawingPoint }
  | { kind: 'complete'; p1: DrawingPoint; p2: DrawingPoint }
  | { kind: 'ignore' }

function decideTwoPointTap(
  currentP1: DrawingPoint | null,
  mappedPoint: DrawingPoint | null,
): TwoPointPlacement
```

The effect stage sets draft and preview for `start`; clears draft and invokes the existing completion callback with the active tool for `complete`; and does nothing for `ignore`. Keep the existing callback contract, shape geometry, and persistence path.

### Implementation steps

1. Add focused tests for the pure decision: missing mapped point, first valid tap, second valid tap, and reverse direction. Assert that a missing point does not clear an active draft.
2. Add interaction regression tests for rectangle and one other two point tool: first tap previews, second tap completes once with the same points and correct kind. Cover cancellation or tool change according to current behavior. Record current behavior before changing any lifecycle semantics.
3. Extract the pure decision, add typed `pipe` and `effect` helpers, and wire the shared two point branch in `handleChartTap` through the composed workflow. Leave icon, text, extension, polyline, and coarse pointer paths as they are.
4. Run the focused tests, TypeScript check, and lint on changed files. Manually verify rectangle and another two point tool: placement, preview, cancel, reverse direction, and selection.
5. Compare the before and after call path for readability, number of state mutations, and branching. Keep the extraction only if it makes the path clearer without adding indirection.

### Done when

- Two point placement behavior is unchanged for fine pointers across rectangle, trendline, Fibonacci range, and warning circle.
- The decision can be tested without DOM, React refs, or chart mocks.
- The map, decide, and effect stages are visible together in the workflow definition.
- Tests cover start, complete, invalid coordinate, and cancellation behavior.
- No new runtime dependency or package boundary is introduced; the composition helpers have ordering, propagation, and type-level tests.

## Next slices, only after the first is reviewed

1. **Shared preview and lifecycle decisions:** Look for a second genuinely shared decision in preview updates or cleanup. Extract it only after tests establish common semantics across tools.
2. **Lifecycle cleanup:** Make cancellation, pointer capture release, and pending animation frame cleanup explicit for both fine and coarse pointers. Add integration tests for pointer cancellation and validation failure before changing semantics.
3. **Core expansion:** When another real workflow needs sequencing, guards, or additional `pipe` arities, add only the required operators. Keep the core free of chart, DOM, and React imports. Document stop, failure, and exception semantics before expanding the API.
4. **Evaluation:** Compare the composed workflow with the original imperative equivalent using representative pointer movement and completion cases. Measure execution time and allocation on equivalent work. If the composition is harder to follow or causes material frame cost, retain ordinary functions for that path.

## Scope limits and decisions to revisit

- Do not introduce the TDD's package layout, Canvas playground, general `defineTool`, tracing, asynchronous flow, or private npm package in the first slice.
- Do not fold the current touch path into the fine pointer path until its seed and confirmation semantics are covered by tests.
- Do not promise transaction or undo behavior from a composition helper. Document persistence and undo integration separately when that path is in scope.
- Do not add grid snapping, square constraints, or minimum size rules from the TDD's Canvas example to the existing chart unless they become product requirements.

The decision gate for broader adoption is practical: a developer should be able to identify event conversion, placement decision, preview effect, and completion effect more quickly than in the current code, with no regression in drawing behavior.
