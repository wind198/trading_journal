# Chart behavior composition: third slice action plan

**Status:** Implemented; manual coarse pointer verification pending  
**Prerequisite:** [Second slice](./chart-behavior-composition-slice-2.md)  
**Scope:** Coarse pointer placement of `fibonacci_range_extension` only

## Goal

Move the remaining coarse pointer three anchor drawing lifecycle out of `bind-price-chart-interaction.ts` into a session class. The class will own `p1`, `p2`, `p3`, and the active phase. The adapter will continue to own Lightweight Charts coordinate conversion, pointer capture, movement threshold, and animation frame scheduling.

This is a separate class from `CoarseTwoPointDrawingSession`. The third confirmation and its geometry are tool-specific. Do not add inheritance or a generic N-point controller before comparing real behavior.

## Behavior to preserve

```text
select extension → seed p1 at viewport center → placing_p1
drag p1; tap → create default p2 → placing_p2
drag p2; tap → create default p3 → placing_p3
drag p3; tap → complete with p1, p2, p3
```

The current default `p2` comes from `defaultShapePreviewP2(p1, candles)`. The default `p3` takes its time from `defaultShapePreviewP2(p2, candles)` and its price from `(p1.price + p2.price) / 2`. Completion calls `onComplete` with `{ kind: 'fibonacci_range_extension', p1, p2: p3, points: [p1, p2, p3] }`. That unusual `p2: p3` field is part of the existing callback contract and must remain unchanged in this slice.

Drag starts only after `TAP_MOVE_THRESHOLD_PX`; releasing a drag does not confirm a point. The active anchor moves relative to its screen position at pointer down. Invalid mapping, nonfinite values, or `time <= 0` must not change an anchor. The existing three anchor preview and second anchor position must survive movement of `p3`.

## Proposed session

Add a chart-domain `CoarseThreePointDrawingSession` with an explicit state union:

```ts
type ThreePointState =
  | { phase: 'idle' }
  | { phase: 'placing_p1'; p1: DrawingPoint }
  | { phase: 'placing_p2'; p1: DrawingPoint; p2: DrawingPoint }
  | { phase: 'placing_p3'; p1: DrawingPoint; p2: DrawingPoint; p3: DrawingPoint }
```

Expose `seed(p1)`, `moveActiveAnchor(point)`, `confirm()`, `cancel()`, `state`, and `activePoint`. Keep confirm transitions in a pure decision function, with a typed map → decide → effect pipeline where it makes the three stage order clear. Use ports for default anchor calculation, immediate preview, scheduled drag preview, preview cleanup, and completion. The session must not import React, DOM, or Lightweight Charts.

## Work sequence

1. **Characterize the current path.** Expand `bind-price-chart-interaction.test.ts` to assert seed, each drag, each tap transition, preview values, one completion, reverse direction, invalid coordinates, cancellation, tool switch, and chart unbind. Keep the existing three anchor regression test as a baseline.
2. **Add pure transition and session tests.** Cover `idle`, all three placement phases, duplicate confirmation, invalid movement, repeated cancellation, and callback errors. Assert that moving `p3` never changes `p2`.
3. **Implement the session.** Keep all anchor and phase state in the class. The adapter should pass calculated drawing points to `moveActiveAnchor` and handle animation frames through ports, as in the second slice.
4. **Route extension events.** Replace extension-specific reads and writes of `draftRef`, `touchShapePhaseRef`, `shapePreviewP2Ref`, and `shapePreviewP3Ref` in `seedTouchShapeDraft`, `confirmTouchShapePoint`, `activeTouchShapePoint`, and coarse pointer move handling. The preview refs may remain as renderer projections, but the session must never read them as its source of truth.
5. **Wire lifecycle cleanup.** Seed on tool selection and fall back to seed on pointer down if needed. On Escape, tool change, pointer cancellation, and chart unbind, discard queued preview work, cancel the session, clear the preview, and release pointer capture. Preserve the existing completion callback payload.
6. **Remove obsolete state.** Once no path uses the legacy touch phase or anchor refs as state, remove the related helper and refs. Keep any renderer projection refs that are still needed by other tools.
7. **Verify and review.** Run the focused chart/session suite, TypeScript check, and whitespace check. Manually exercise all three anchor drags and cancellation on a coarse pointer device or emulator. Compare the adapter before and after for reduced branching and one clear owner of each anchor.

## Acceptance criteria

- All three anchors can be dragged independently and confirmed by tap; drag release never advances the phase.
- The default `p2` and `p3` coordinates match current behavior.
- Preview retains `p2` while `p3` moves.
- Completion fires once with the existing `p1`, `p2: p3`, and `points: [p1, p2, p3]` payload.
- Invalid mapping does not mutate the current phase or geometry.
- Escape, tool switch, pointer cancellation, and chart unbind leave no extension draft, pending preview frame, or pointer capture.
- Coarse two point and fine pointer drawing regression tests still pass.
- No persistence change, new runtime dependency, base class, or generic workflow package is introduced.

## Boundary after this slice

Review the two coarse sessions for matching seed, move, cancel, and preview port behavior. Extract a small shared interface or helper only where the semantics and cleanup order are identical. Fine pointer extension placement, polyline arrows, icons, text anchors, and drawing edits remain separate work.

## Implementation check

`CoarseThreePointDrawingSession` now owns all three anchors and the active phase. The adapter keeps coordinate conversion, movement threshold, pointer capture, and animation frame scheduling. The legacy touch phase ref and seeding helper were removed; preview refs remain only as renderer projections. Pointer cancellation discards queued preview work and clears the session.

The focused chart and session suite passes (40 tests), including the fine pointer extension regression. The project TypeScript check still reports existing errors in `non-trade-warning-banner.tsx` and none in the changed chart files. Manual verification on a coarse pointer device or emulator remains to be done.
