# Chart behavior composition: second slice plan

**Status:** Implemented; manual coarse pointer verification pending  
**Prerequisite:** Fine pointer `TwoPointDrawingSession` from the approved [drawing tool TDD](./tdd-chart-drawing-tool-composition.md)  
**Scope:** Coarse pointer placement for rectangle, trendline, Fibonacci range, and warning circle

## Goal

Move the existing coarse pointer two point drawing lifecycle into a class that owns its temporary geometry and phase. Reuse the same chart adapter ports and completion contract as the fine pointer session. Preserve the current viewport seed, drag relative to the active anchor, tap confirmation, preview, and two point completion behavior.

This slice should make the lifecycle visible and testable without React refs or DOM events. It does not add another generic flow operator simply to express the touch phases.

## Current behavior to preserve

The coarse pointer path spans `seedTouchShapeDraft`, `confirmTouchShapePoint`, `activeTouchShapePoint`, and the overlay pointer handlers in `bind-price-chart-interaction.ts`. `price-chart.tsx` also seeds the draft when a coarse pointer tool is selected. The flow is:

```text
select tool → seed p1 at viewport center → placing_p1
drag → move p1 relative to its screen position
tap → choose or synthesize p2 → placing_p2
drag → move p2 relative to its screen position
tap → clear preview and complete one drawing
```

Dragging begins only after the existing movement threshold. Pointer up after a drag does not confirm a point. Invalid mapped coordinates do not update an anchor. The current `fibonacci_range_extension` adds `placing_p3`; it is outside this slice.

## Proposed design

Add a `CoarseTwoPointDrawingSession` in `_lib/chart/` with an explicit state union:

```ts
type CoarseTwoPointState =
  | { phase: 'idle' }
  | { phase: 'placing_p1'; p1: DrawingPoint }
  | { phase: 'placing_p2'; p1: DrawingPoint; p2: DrawingPoint }
```

Suggested operations are `seed(p1)`, `moveActiveAnchor(point)`, `confirm()`, `cancel()`, and a read-only `activePoint` for the adapter's drag-origin calculation. `confirm()` returns or applies an explicit transition decision. A pure decision function should cover `placing_p1 → placing_p2` and `placing_p2 → complete`; the class applies preview and completion effects. Use the existing typed `pipe` where a real map → decide → effect sequence improves readability. Keep lifecycle state in the class; do not mirror `p1`, `p2`, or phase in independent mutable refs.

The class receives small ports for preview, clearing, completion, and calculating the initial `p2` offset from `p1` and current candles. The adapter remains responsible for Lightweight Charts coordinate conversion, pointer IDs, pointer capture, screen-to-chart mapping, and animation frame scheduling. Do not add a base class or make the coarse session inherit from `TwoPointDrawingSession`: their event semantics differ. A narrow shared interface such as `cancel()` can be introduced only if the adapter actually uses it to replace tool-specific cleanup.

## Integration steps

1. **Characterize behavior first.** Extend the existing pointer harness for all four coarse two point tools. Assert viewport seeding, movement threshold, drag without confirmation, first tap phase change, second tap completion, invalid coordinates, reverse direction, Escape/tool switch, and pointer cancellation. Record the current pointer cancellation behavior before changing it.
2. **Implement the session and pure transitions.** Unit test every phase, duplicate taps, repeated cancel, callback order, and errors. Preserve the existing default `p2` calculation from `defaultShapePreviewP2` and the existing coordinate validity rule.
3. **Route the four tools.** Replace their reads and writes of `touchShapePhaseRef`, `draftRef`, and `shapePreviewP2Ref` with the session state. Keep the three point extension on the old path, including `placing_p3`. Update `price-chart.tsx` tool selection so only one coarse session seeds and owns the two point draft.
4. **Make cleanup explicit.** On Escape, tool switch, chart unbind, and pointer cancellation, cancel the coarse session and clear its preview. Release pointer capture and cancel any queued preview frame in the adapter. Treat pointer cancellation clearing the draft as an intentional behavior change if characterization confirms the current handler leaves it visible.
5. **Verify and compare.** Run focused unit and interaction tests, type-level tests where new composition is introduced, and the project TypeScript check. Manually verify on a coarse pointer device or emulator: seed, both anchor drags, tap confirmation, cancellation, and tool switching. Compare the event handler before and after for state ownership and branching.

## Acceptance criteria

- Rectangle, trendline, Fibonacci range, and warning circle complete exactly once with the same `kind`, `p1`, and `p2` as the current flow.
- A drag updates the active anchor but never confirms it on pointer up; a tap confirms the current phase.
- The initial anchor is seeded at the viewport center, and the second anchor uses the current default offset when no preview endpoint exists.
- Invalid mapping leaves geometry and phase unchanged.
- Escape, tool switch, pointer cancellation, and chart unbind leave no two point draft, queued preview frame, or pointer capture.
- The coarse session is the only owner of its phase and anchor points. React refs may hold the session instance, but not competing copies of its state.
- Fine pointer two point behavior and the three point extension remain covered by passing regression tests.
- No new runtime dependency, inheritance hierarchy, persistence change, or generic framework package is introduced.

## Deferred

The three point Fibonacci extension, polyline double-tap workflow, icon/text placement, and drawing edits remain in their current paths. After this slice, compare the fine and coarse sessions for genuinely shared lifecycle or effect code. Extract only behavior with matching semantics; keep pointer-specific transitions separate.

## Implementation check

The coarse two point session now owns phase and anchor state. The adapter retains coordinate conversion, pointer capture, and animation frame scheduling. Pointer cancellation clears the two point draft and discards its queued preview; the three point extension keeps its existing path.

The focused chart and session suite passes (33 tests). The project TypeScript check still reports existing errors in `non-trade-warning-banner.tsx` and none in the changed chart files. Manual verification on a coarse pointer device or emulator remains to be done.
