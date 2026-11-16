# Chart stateful sessions: refactor plan

**Status:** Implemented for chart drawing sessions; browser review pending  
**Target:** `app/(app)/trading-dashboard/_components/chart/_sessions/`  
**Scope:** User interactions that hold temporary state while creating, editing, or configuring chart drawings

## Goal

Put the lifecycle of each stateful chart interaction in `_sessions/`. A session owns its temporary state from start through completion or cancellation. Drawing objects under `_components/objects/` continue to own their hit rules, geometry, and rendering. The chart mediator continues to own event subscriptions and routing. React owns visible UI state and persistence remains behind callbacks supplied as ports.

Moving files alone is insufficient: `price-chart.tsx` and `chart-interaction-composition.ts` currently retain draft points, touch phases, active press and drag state, and cleanup paths that overlap the session classes. The refactor should remove those competing sources of truth as each session takes ownership.

## Directory boundary

```text
chart/
  _components/
    objects/<object>/            primitive and object-specific edit/placement rules
    indicators/                  future indicator modules
  _sessions/
    create/                      placement lifecycle for new drawings
    edit/                        active pointer edit lifecycle, shared contract, and hit priority registry
    configure/                   draft settings/label changes and save/cancel lifecycle
    session-contract.ts          small shared lifecycle types, only if useful
  price-chart-interaction-mediator.ts  chart/DOM listener lifecycle
  chart-interaction-composition.ts     construct and connect collaborators
```

A session is justified when it holds state across events, such as the first point, active pointer ID, selected edit session, pending press, or unsaved label draft. Pure geometry helpers, primitive rendering, hit tests, static settings, and ordinary one-event commands do not become sessions. Do not introduce an inheritance tree merely to make the files look uniform.

## Session contract

Use a minimal lifecycle vocabulary rather than forcing every interaction through the same event signatures:

```ts
interface ChartSession {
  cancel(): void
  dispose(): void
}
```

Each concrete class exposes only the inputs it needs: `tap`/`hover`/`confirm` for creation, `pointerDown`/`pointerMove`/`pointerUp` for editing, and `open`/`changeDraft`/`save` for configuration. Session state should be a discriminated union with a read-only getter. Ports supply coordinate mapping, preview, change, completion, and persistence effects. A session must never import React components or database clients.

Define callback order explicitly for each session. On completion, clear its active state and preview before calling the host completion callback, matching existing placement behavior. On edit cancellation, release capture and invoke the existing change-end callback exactly once if an edit began. Failed point mapping must leave the session and geometry unchanged.

## Inventory and intended owners

| Current state or work | Current location | Target |
| --- | --- | --- |
| Fine two-point first point, hover, completion | `_lib/chart/two-point-drawing-session.ts` | `_sessions/create/two-point-drawing-session.ts` |
| Coarse two-point seed, drag, confirm | `_lib/chart/coarse-two-point-drawing-session.ts` | `_sessions/create/coarse-two-point-drawing-session.ts` |
| Coarse extension seed, three drag/confirm phases | `_lib/chart/coarse-three-point-drawing-session.ts` | `_sessions/create/coarse-three-point-drawing-session.ts` |
| Polyline points and double-tap timing | `_components/objects/polyline/polyline-placement-behavior.ts` | `_sessions/create/polyline-creation-session.ts`; polyline-specific decision/geometry stays with the object |
| Fine extension points and hover preview | `chart-interaction-composition.ts` plus `price-chart.tsx` refs | `_sessions/create/fibonacci-extension-creation-session.ts` |
| Icon/text one-point placement | `chart-interaction-composition.ts` | A small `_sessions/create/point-creation-session.ts` only if it truly needs state; otherwise a stateless command in the object adapter |
| Active edit, pointer ID, pending press, threshold, finish/cancel | `_sessions/edit/drawing-edit-session.ts` | Already located in `_sessions/edit/`; simplify lifecycle in this phase |
| Shared tool edit contract and hit priority | `_sessions/edit/edit-contract.ts`, `edit-tool-registry.ts` | Already located in `_sessions/edit/`; keep beside the edit session |
| Tool-specific edit eligibility and geometry | `_components/objects/<object>/*-edit-behavior.ts` | Stay with the object; return a tool edit operation to the edit session |
| Preview animation frame and pointer capture | `drawing-preview-scheduler.ts`, `chart-pointer-adapter.ts` | Stay as shared adapters; sessions call their ports |
| Label editor target, unsaved label, save/cancel | `trading-dashboard.tsx` | `_sessions/configure/drawing-label-session.ts`, with the dialog remaining a React view |
| Peak detection settings | `trading-dashboard.tsx` | Leave in dashboard for now; move only when indicator configuration has a clear open/draft/apply/cancel lifecycle |

The `_lib/chart/two-point-placement.ts` pure decision and `_lib/flow/pipe.ts` stay in `_lib`. Moving the session classes must not pull those pure helpers into a component directory or create duplicate copies.

## Migration sequence

### 1. Establish the lifecycle tests

Before moving behavior, record creation, edit, and label configuration semantics. Cover preview order, reverse and zero-size placements, coarse confirmation phases, tool switch, Escape, pointer cancel, lost capture, callback counts, synthetic click suppression, label Save/Cancel, and persistence failure. Keep one chart integration test for each route; unit tests should exercise session transitions without React.

### 2. Move the existing creation sessions

Move the three existing placement classes and their tests into `_sessions/create/`; update imports. Keep their public APIs and behavior unchanged. Construct them through a small creation-session registry or factory so `price-chart.tsx` no longer stores a separate ref for each concrete class. The registry should own replacement on tool switch and `cancelAll`/`dispose` on chart teardown. It must not become a second event mediator.

### 3. Finish creation state ownership

Move polyline point/tap state into a creation session. Extract fine Fibonacci extension point state from `polylineDraftRef` and the tap/hover branches in `chart-interaction-composition.ts`. Consolidate coarse touch drag origin and active pointer state with the relevant creation session or a shared pointer gesture session. Remove `draftRef`, `shapePreviewP2Ref`, `shapePreviewP3Ref`, and touch-phase refs only after every consumer reads session state or a derived view model. Preview rendering remains an injected effect.

### 4. Extract the edit session

Refine `DrawingEditSession`'s active edit, pointer ID, pending icon/text press, threshold, and end/cancel logic in `_sessions/edit/drawing-edit-session.ts`. The current object edit behaviors continue to answer hit eligibility and produce geometry changes. The shared contract and explicit priority registry live beside the session. Remove duplicate edit state refs; `editSessionRef` may remain as the React bridge until a session registry owns disposal. The chart mediator forwards normalized events; it does not inspect drawing kinds.

### 5. Add the first configure session

Use label editing as the concrete case. `DrawingLabelSession` owns `{ status: 'closed' } | { status: 'editing'; id; original; draft; kind }` and exposes `open`, `changeDraft`, `save`, and `cancel`. The dashboard dialog renders the session snapshot and sends user actions to it. Save routes through a port that retains the existing text/circle versus polyline persistence methods and error recovery. Decide and test whether Save closes before the async write, as the current code does; preserve that behavior unless a separate product change is approved. Do not move Supabase calls, toasts, or dialog markup into the session.

### 6. Review configuration scope

Audit indicator controls such as peak detection. A plain applied value controlled by React does not need a session. Add a configure session later when a control has a temporary draft, Apply/Cancel, multi-step setup, or rollback requirements. Keep indicator drawing migration separate from this session refactor.

### 7. Simplify composition and React refs

`chart-interaction-composition.ts` should construct sessions and connect ports, then route events in a small number of named handlers. `price-chart.tsx` should keep only chart handle, live prop/callback refs, and UI state that React must render. Remove duplicated draft and active-gesture refs after their owning sessions are wired. Ensure chart recreation disposes every session and releases capture once.

## Ownership rules

- One active create session and one active edit session may exist, but drawing mode must cancel an active edit before creation begins. A configure session may coexist with a selected drawing; opening it should end any active pointer edit.
- Sessions own temporary interaction state, not persisted drawings. The dashboard still owns the drawing collection and save callbacks.
- Object folders own geometry and tool-specific decisions. A shared session may be reused by rectangle, trendline, Fibonacci range, and warning circle without creating four identical classes.
- The mediator owns subscriptions only. It does not create sessions, calculate coordinates, hold draft points, or call persistence APIs.
- Session ports are narrow and named. Avoid passing `PriceChartInteractionRefs`, `ChartHandle`, or the dashboard component into a domain session unless a chart adapter is explicitly part of that session's responsibility.

## Acceptance and verification

- Every cross-event drawing draft, edit gesture, and unsaved label draft has one session owner; no mirror refs hold the same mutable state.
- Object-specific edit code remains in `_components/objects/`; indicator primitives remain in their current location for the later migration.
- Tool switch, Escape, pointer cancel, chart recreation, and disposal leave no preview, pointer capture, or pending callback.
- Existing create/edit payloads and persistence behavior stay the same. No new runtime dependency or database schema change.
- Run focused creation, edit, interaction, and configuration tests, then `tsc --noEmit --incremental false` and `git diff --check`. Manually exercise mouse and touch create/edit plus label Save/Cancel in the dashboard.
- Report the existing `non-trade-warning-banner.tsx` TypeScript errors separately until they are fixed. The Fibonacci extension primitive test expectations currently differ from the existing ten-level implementation; do not silently change either as part of this refactor.

## First implementation slice

Start with moving the three existing placement sessions into `_sessions/create/` and introducing the creation registry. This is a mechanical, reviewable step with existing tests. Then extract fine extension creation state, which is currently split across composition and React refs. Review ownership before starting edit and configure sessions.

The edit files were organized into `_sessions/edit/` ahead of this sequence. Creation sessions, a creation registry, coarse pointer gesture state, and the first configure session are now implemented. Indicator drawing and indicator settings remain deferred as requested.

## Implementation record

- Moved the fine and coarse two-point and three-point creation classes into `_sessions/create/`. The registry now owns their instances and tool-switch cleanup.
- Moved polyline point/double-tap state into a creation session, added fine Fibonacci extension creation state, and moved overlay pointer gesture state into `CreationPointerSession`.
- Removed duplicate draft-anchor refs from `PriceChart`. The old coarse confirmation button condition was unreachable because `isTouchSeedShapeTool` covers every `isShapeDrawTool` value; its unused UI state and callback were removed.
- `DrawingEditSession` now releases pointer capture through its port on tool switch and disposal. Object-specific geometry remains in `_components/objects/`.
- `DrawingSelectionSession` owns pointer tap, label double-tap, drag suppression, and synthetic-click suppression; the corresponding React refs were removed.
- A stateless draft adapter now routes previews to primitives, so `PriceChart` no longer contains the per-tool preview switch.
- `DrawingLabelSession` owns the unsaved label draft and closes before the dashboard persists Save, preserving the previous order. The dashboard still owns dialog rendering, persistence, and recovery after a failed save.
- The focused session and interaction suite passes. Manual mouse/touch and label-dialog review in a browser remains pending. Project TypeScript still reports only the existing `non-trade-warning-banner.tsx` errors.
