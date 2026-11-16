# Chart interaction mediator: extraction plan

**Status:** Implemented; browser gesture review pending  
**Target:** `app/(app)/trading-dashboard/_components/chart/bind-price-chart-interaction.ts`  
**Approach:** One mediator for event routing; composed behaviors for drawing work

## Goal

Turn the current chart interaction binder into a small mediator that owns event subscriptions, dispatch order, and teardown. Move selection, editing, placement, gesture tracking, coordinate mapping, pointer capture, and preview scheduling into focused collaborators. The mediator must not become the existing 1,019-line function copied into a class.

The first extraction is drawing selection and edits, because the pointer-down through pointer-cancel block currently contains hit testing, several drag modes, geometry changes, callbacks, and capture handling. Complete the migration in reviewable steps without registering a second set of listeners.

## Current responsibilities in the binder

| Area | Current location | Intended owner |
| --- | --- | --- |
| DOM and chart subscriptions | `subscribeClick`, `subscribeCrosshairMove`, pointer and double-click listeners | `PriceChartInteractionMediator` |
| Hit testing and selected drawing | `handleChartTap`, `onChartPointerDown`, `onDoubleClick` | Selection behavior plus chart hit-test adapter |
| Anchor, whole-shape, polyline, and extension edits | `onChartPointerDown/Move/Up/Cancel` | `DrawingEditBehavior` |
| Fine and coarse placement | `handleChartTap`, overlay pointer handlers | Existing drawing sessions behind a placement router |
| Pointer identity, tap threshold, capture | Both chart and overlay handlers | Pointer gesture/capture adapter |
| Draft animation frames | `scheduleShapeDraft`, `flushDraftRaf`, `discardDraftRaf` | Preview scheduler |
| Coordinate conversion | `clickToPoint`, `drawingPointToScreen`, `localPoint` calls | Chart coordinate adapter |

The `PriceChartInteractionRefs` object is also broad. Each collaborator should receive only the live inputs and callbacks it needs. React can still hold session instances, but drawing edit state must have one owner rather than being copied into refs and collaborator fields.

## Target shape

```text
PriceChart
  → bindPriceChartInteraction(...)  // compatibility entry point
      → PriceChartInteractionMediator
          → PlacementRouter → existing drawing sessions
          → DrawingSelectionBehavior
          → DrawingEditBehavior
          → PointerGestureAdapter / PreviewScheduler / ChartCoordinates
```

The mediator may use a class because it owns subscription lifecycle. Its methods should read like routing rules: normalize event, check whether drawing mode is active, delegate to one behavior, then apply the returned event policy (`preventDefault`, suppress synthetic click, or update interaction lock). It should not calculate drawing geometry or hold per-tool phases.

Behaviors may be classes when they own interaction state. Pure calculations should remain functions. Use the existing typed `pipe` only where named mapping, decision, and effect stages make a workflow clearer; do not add a class hierarchy or operators for every branch.

## Contract boundaries

- **Mediator input:** chart/overlay elements, chart handle, live getters for active tool and candle data, and collaborators. Keep one event listener set for each chart instance.
- **Behavior input:** normalized screen point, pointer ID/type, and the minimum chart-domain data required for that operation. Avoid passing the entire `PriceChartInteractionRefs` object.
- **Behavior result:** whether the event was handled and any routing policy needed by the mediator. External mutations go through named ports such as `select`, `changeDrawing`, `finishChange`, or `requestPreview`.
- **Ownership:** `DrawingEditBehavior` owns active drag and pending icon/text press. Placement sessions own placement anchors. The mediator owns no drawing geometry.
- **Teardown:** the mediator removes every DOM listener and unsubscribes chart callbacks with `unsubscribeClick` and `unsubscribeCrosshairMove`, both verified in the installed Lightweight Charts v5 typings. It cancels active behaviors and releases capture once.

## Migration sequence

### 1. Characterize selection and edit behavior

Extend the existing interaction harness before moving code. Cover closest-hit selection, label double-click precedence, icon/text press threshold, anchor drag, whole Fibonacci range movement, warning-circle center movement with rim offset preserved, polyline vertex movement, whole extension movement, callback order, pointer cancellation, and synthetic click suppression. Record current behavior where cancellation calls a change-end callback.

### 2. Extract drawing edits

Create `DrawingEditBehavior` with its own discriminated active-drag state and injected ports for hit tests, coordinate mapping, capture, interaction lock, and change callbacks. Move the chart pointer-down/move/up/cancel edit branches to it. Keep geometry transformations as named, independently testable functions. Return a small routing result to the mediator or temporary binder. Remove `dragRef`, `polylineDragRef`, and `iconPressRef` when the behavior is the sole owner.

Keep the existing completion semantics: one `onChangeEnd` or `onPolylineChangeEnd` for a started drag, no edit callback for an unmappable point, and no second callback from a later synthetic click.

### 3. Extract selection

Create a selection behavior that resolves candidate hits, applies the current nearest-distance rule, and handles label double taps. Keep renderer-specific hit-test calls in an adapter. Selection invokes the existing `selectDrawing` and label-edit callbacks. Preserve the current hit priority for equal distances and the temporary-ID exclusions. Remove selection-specific refs only after the behavior owns them.

### 4. Introduce the mediator

Add `PriceChartInteractionMediator` and move all chart and DOM subscription setup into `start()` and teardown into `dispose()`. Route normalized events to the extracted edit and selection behaviors plus the existing placement sessions. Keep `bindPriceChartInteraction` as a thin wrapper returning `dispose`. Migrate one event family at a time while retaining exactly one registered listener per event.

### 5. Finish delegation

Move remaining placement routing, pointer capture, and draft frame scheduling behind small adapters. Move single-point, fine extension, and polyline placement behavior only after their current semantics have regression tests. Stop when the mediator contains registration, routing, and cleanup but no hit-test lists, geometry math, placement phases, or document callbacks embedded in event handlers.

## Acceptance criteria

- The mediator is the only owner of listener/subscription lifecycle and unsubscribes every chart callback it registers.
- Each event is handled once; tool changes and chart recreation do not duplicate listeners or completion callbacks.
- Drawing edits and selection have focused tests independent of React and DOM listener registration.
- Drag state is owned by one behavior. Placement state remains in the existing sessions.
- All existing fine/coarse placement tests pass; selection and edit behavior matches the recorded baseline.
- Pointer cancellation, tool switches, and `dispose()` release capture and clear active interaction state.
- The binder becomes a compatibility entry point, and the mediator contains only event routing and teardown. Review the resulting file size and call path as evidence, not as a fixed line-count target.
- No new runtime dependency, framework package, or persistence change is introduced.

## Verification and review gate

Run focused session, selection, edit, and interaction tests; type-level checks for any new composition; the project TypeScript check; and `git diff --check`. Manually test drawing and editing on fine and coarse pointers. The project currently has unrelated TypeScript errors in `non-trade-warning-banner.tsx`; report those separately until the project-wide check is clean.

After the edit and selection extractions, review the adapter before proceeding. If the mediator is accumulating domain branches, move the branch into a behavior rather than adding another mediator method. Preserve the user's existing change to `fibonacci-range-primitive.ts` throughout this work.

## Implementation record

- `bindPriceChartInteraction` is a small compatibility entry point. `PriceChartInteractionMediator` owns exactly one listener set and removes chart subscriptions on disposal.
- `DrawingEditBehavior`, `DrawingSelectionBehavior`, and `PolylinePlacementBehavior` own their interaction state. Existing two- and three-point sessions retain their placement phases.
- `ChartPointerAdapter` owns pointer capture and chart-relative coordinates; `DrawingPreviewScheduler` owns pending draft frames. `chart-interaction-composition.ts` wires these collaborators and contains the remaining placement routing. This composition root remains sizeable because it connects the existing React refs, sessions, and chart primitives; it owns no DOM subscriptions.
- Focused automated tests cover the mediator lifecycle, representative selection/edit behaviors, polyline placement, and fine/coarse drawing sessions. Browser testing of real mouse and touch gestures remains to be done.
