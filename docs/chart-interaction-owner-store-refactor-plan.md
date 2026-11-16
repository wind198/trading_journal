# Chart interaction owner/store refactor plan

## Objective

Replace the large tool-aware interaction composition with a thin mediator and a scope-agnostic interaction store. Each drawing object or indicator owns its creation, hit-test, edit, and configuration rules. The store owns all active state and lifecycle transitions.

Adding a new object or indicator must require registering its behavior only. It must not require new branches in the mediator, store, pointer adapter, or chart composition root.

## Architectural rules

1. The mediator owns subscriptions and event normalization only.
2. The store owns active interaction state: mode, owner, pointer, phase, draft state, commit, cancellation, and disposal.
3. Object and indicator behaviors are stateless policies. They calculate transitions and scope effects from the state passed by the store.
4. Primitives draw and expose drawing-specific hit geometry. They do not own pointer lifecycle state.
5. React adapters expose current props and persistence callbacks through ports. Behaviors do not import React refs.
6. Registries contain behavior instances and generic priority metadata. They do not switch on drawing kinds.
7. Shared algorithms such as two-point placement remain reusable building blocks. A concrete object owns their configuration and public behavior.

The scope state stored by the generic store may be opaque to the store. It remains typed inside the owning behavior through a type-erased registry adapter. This keeps state centralized without teaching the store about rectangle points, Fibonacci phases, polylines, or indicator settings.

## Target event flow

```text
Lightweight Charts / DOM events
              │
              ▼
   PriceChartInteractionMediator
   subscribe · normalize · dispose
              │ InteractionEvent
              ▼
       InteractionStore
   active owner · mode · phase · state
              │ resolve/transition
              ▼
       InteractionOwnerRegistry
              │
      ┌───────┴────────┐
      ▼                ▼
 Object behavior   Indicator behavior
 pure scope rules  pure scope rules
      │                │
      └───────┬────────┘
              ▼
       InteractionEffectRunner
 preview · select · persist · configure
```

## Core contracts

Create these contracts first and keep them independent of `ChartDrawingKind`, individual primitive classes, and React.

```ts
export type WorkflowKind = 'create' | 'edit' | 'select' | 'configure'

export type InteractionEvent =
  | { type: 'pointer-down'; pointer: NormalizedPointer }
  | { type: 'pointer-move'; pointer: NormalizedPointer }
  | { type: 'pointer-up'; pointer: NormalizedPointer }
  | { type: 'pointer-cancel'; pointerId: number }
  | { type: 'chart-click'; point: ScreenPoint | null }
  | { type: 'double-click'; point: ScreenPoint }
  | { type: 'crosshair-move'; point: ScreenPoint | null }
  | { type: 'confirm' }
  | { type: 'cancel' }

export type InteractionResult<State> = {
  state: State
  status: 'active' | 'committed' | 'cancelled'
  effects?: readonly InteractionEffect[]
}

export interface Creatable<State, Input> {
  readonly id: string
  beginCreation(input: Input): InteractionResult<State> | null
  continueCreation(state: State, event: InteractionEvent): InteractionResult<State>
}
```

`InteractionEffect` should describe generic host work such as pointer capture/release, selection, preview invalidation, persistence, configuration UI, or interaction locking. Scope payloads remain opaque and carry the owner ID. The effect runner resolves the owner and lets it apply its own preview or persistence payload. Do not grow a union containing every object type.

The store exposes a small API:

```ts
class InteractionStore {
  get snapshot(): InteractionSnapshot
  begin(request: WorkflowRequest): boolean
  dispatch(event: InteractionEvent): boolean
  cancel(reason: InteractionCancelReason): void
  subscribe(listener: InteractionListener): () => void
  dispose(): void
}
```

`InteractionSnapshot` contains generic lifecycle data plus opaque owner state. Consumers may inspect `status`, `mode`, and `ownerId`; only the registered owner interprets its scope state.

## Target project structure

```text
app/(app)/trading-dashboard/_components/chart/
├── _sessions/
│   ├── interaction-contract.ts
│   ├── interaction-store.ts
│   ├── interaction-owner-registry.ts
│   ├── interaction-effect-runner.ts
│   └── shared/
│       ├── two-point-placement.ts
│       ├── three-point-placement.ts
│       └── tap-sequence.ts
├── _components/
│   ├── objects/
│   │   ├── rect/
│   │   │   ├── rectangle-primitive.ts
│   │   │   └── rectangle-behavior.ts
│   │   ├── trendline/
│   │   │   ├── trendline-primitive.ts
│   │   │   └── trendline-behavior.ts
│   │   ├── fibonacci-range/
│   │   │   ├── fibonacci-range-primitive.ts
│   │   │   └── fibonacci-range-behavior.ts
│   │   ├── fibonacci-extension/
│   │   │   ├── fibonacci-range-extension-primitive.ts
│   │   │   └── fibonacci-extension-behavior.ts
│   │   ├── polyline/
│   │   │   ├── polyline-arrow-primitive.ts
│   │   │   └── polyline-behavior.ts
│   │   └── ...
│   └── indicators/
│       ├── peaks/
│       │   ├── peak-overlay-primitive.ts
│       │   └── peak-indicator.ts
│       └── ...
├── chart-interaction-ports-adapter.ts
├── chart-pointer-adapter.ts
├── price-chart-interaction-mediator.ts
└── chart-interaction-composition.ts
```

At completion, `chart-interaction-composition.ts` is only the composition root: construct adapters, register owners, create the store and effect runner, start the mediator, and dispose them in reverse order. Target size is approximately 100–150 lines and it contains no tool-kind branches.

## Ownership after refactor

| Concern | Owner |
| --- | --- |
| DOM and chart subscribe/unsubscribe | `PriceChartInteractionMediator` |
| Mouse/touch normalization and pointer capture mechanics | `ChartPointerAdapter` |
| Active mode, owner, pointer, phase, opaque draft and cancellation | `InteractionStore` |
| Owner lookup and hit-test priority metadata | `InteractionOwnerRegistry` |
| React refs, current collections and persistence callbacks | `ChartInteractionPortsAdapter` |
| Rectangle placement/edit rules | `RectangleBehavior` |
| Trendline placement/edit rules | `TrendlineBehavior` |
| Fibonacci range/extension phases | Their respective behaviors |
| Polyline tap, preview and completion rules | `PolylineBehavior` |
| Icon/text/warning-circle hit and edit rules | Their respective behaviors |
| Peak settings validation and transition rules | `PeakIndicator` |
| Canvas rendering and drawing hit geometry | Each primitive |

## Migration strategy

Use a strangler migration. Keep the existing behavior live while one scope at a time moves to the owner/store contracts. Do not rewrite all gestures in one change.

### Slice 1: Lock current behavior and add the generic core

1. Add characterization tests for the current event ordering: click versus pointer release, coarse pointer confirmation, double tap, selection priority, active edit cancellation, tool switch, and disposal.
2. Add `interaction-contract.ts`, `InteractionStore`, owner registry, and effect runner without connecting them to the chart.
3. Test the store with fake owners:
   - begin stores owner, mode, pointer, and opaque state;
   - dispatch replaces state and emits effects in order;
   - commit and cancel return to idle exactly once;
   - beginning another interaction cancels the previous owner first;
   - pointer events from a different pointer ID are ignored;
   - dispose cancels active work and rejects further dispatch;
   - subscribers receive immutable snapshots.
4. Keep the store free of chart, DOM, React, drawing-kind, and primitive imports.

### Slice 2: Normalize the mediator boundary

1. Change `PriceChartInteractionMediator` to emit `InteractionEvent` objects to one injected dispatcher rather than accepting separate tool-aware handlers.
2. Move coordinate and pointer-mode normalization into `ChartPointerAdapter`. Include screen point, chart point when available, pointer ID, primary button, and fine/coarse mode.
3. Keep chart click, crosshair, DOM pointer, double-click, start, and dispose lifecycle in the mediator.
4. Move React refs and callbacks from `PriceChartInteractionRefs`/`Helpers` into `ChartInteractionPortsAdapter`. Expose methods such as current tool, current bars, selected ID, select, preview, persist, and interaction lock.
5. Verify repeated start/dispose remains idempotent and listeners are removed with the same function and options.

### Slice 3: Migrate rectangle as the first vertical slice

1. Replace `RectangleEditBehavior` with `RectangleBehavior` implementing the business workflow interfaces `Creatable` and `Editable`.
2. Move rectangle-specific two-point defaults, preview payload, hit testing, anchor editing, body editing, and commit payload into the rectangle folder.
3. Configure the shared two-point placement helper inside `RectangleBehavior`; keep fine/coarse pointer differences as inputs to the behavior rather than separate store/session types.
4. Register the rectangle owner with creation and edit priorities.
5. Route rectangle interactions through the new store while all other tools continue through the legacy composition.
6. Add tests at the behavior boundary for fine creation, coarse creation, anchor edit, body edit if supported, cancel, and commit. Add an integration test proving the mediator/store contains no rectangle branch.

This slice proves that state can live in the generic store while rectangle rules stay in the rectangle folder.

### Slice 4: Migrate remaining two-point objects

Move trendline, Fibonacci range, and warning circle one at a time.

For each object:

1. Create one `<scope>-behavior.ts` that composes its creation and edit policy.
2. Move default points, hit tests, valid edit handles, preview payload, and persistence mapping into that behavior.
3. Register capability and priority metadata.
4. Delete its old edit behavior after equivalence tests pass.
5. Confirm no new switch or conditional appears in the store, mediator, or composition root.

### Slice 5: Migrate specialized object workflows

1. Move the three-point Fibonacci extension phases into `FibonacciExtensionBehavior`, using the shared three-point helper only for generic phase progression.
2. Move polyline tap sequence, hover preview, double-tap completion, point editing, and label-edit request into `PolylineBehavior`.
3. Move icon and text placement/edit rules into their behaviors.
4. Keep warning-circle geometry with its owner if any behavior remains after Slice 4.
5. Preserve current hit priority by registry metadata. Priority should be data, not hard-coded arrays named `press`, `primary`, `anchors`, and `body` in a central registry.

After this slice, remove `CreationSessionRegistry`, `DrawingEditSession`, `DrawingSelectionSession`, the tool-aware edit registry, and specialized creation session classes once no owner uses them.

### Slice 6: Migrate configuration and indicators

1. Add the `configure` mode to the same store lifecycle; do not create a second configuration store.
2. Make `PeakIndicator` own peak-setting defaults, validation, patch rules, and configuration effects. Move peak draft state from `PeakConfigurationSession` into the generic store's opaque state.
3. Register configuration capability only for indicators or objects that expose settings.
4. Apply the same pattern to drawing labels and future force, engulfing, volume-profile, or session-grid settings.
5. Do not add empty creation or editing workflows to data-driven indicators. Their behavior registers only workflows the product supports.

### Slice 7: Collapse the composition root

1. Remove all remaining tool predicates and workflow factories from `chart-interaction-composition.ts`.
2. Move `defaultShapePreviewP2` to the shared two-point helper or the concrete behaviors that use it.
3. Move primitive update calls behind an object layer method such as `updateHitGeometry()`.
4. Construct object/indicator owners from their existing primitives and ports, register them, then construct the store, effect runner, pointer adapter, and mediator.
5. Make disposal order explicit: mediator, store, effect runner/adapters, then clear external refs.
6. Remove obsolete refs such as `seedCoarseTwoPointRef`, `seedCoarseThreePointRef`, `editSessionRef`, and `selectionSessionRef` after their callers use store commands.

## Transitional compatibility

During migration, introduce a `LegacyInteractionOwner` adapter for scopes that have not moved. It may delegate to existing sessions temporarily. It must be deleted in Slice 7 and must not become a permanent abstraction.

Keep legacy and new ownership mutually exclusive per scope. A pointer event must never reach both paths for the same active tool. Add a routing assertion in development/tests to catch double handling.

## Testing plan

### Generic store tests

- idle → creating/editing/configuring → committed/cancelled → idle;
- owner replacement cancellation order;
- pointer ownership and stale pointer rejection;
- immutable snapshot notification order;
- effect order and exactly-once commit;
- tool switch, chart recreation, and dispose cleanup.

### Per-owner tests

- placement phases and preview geometry;
- hit-test and priority metadata;
- anchor/body edit transitions;
- fine and coarse pointer behavior;
- commit payload and cancel cleanup;
- settings validation, draft, apply, and cancel where supported.

### Integration tests

- listeners attach and detach once;
- pointer capture releases on commit, cancel, tool switch, and dispose;
- selection and double tap retain existing behavior;
- chart scroll/zoom locking matches the current behavior;
- chart recreation leaves no active store, listener, scheduled preview, or captured pointer;
- adding a fake owner requires registration only and no mediator/store edits.

## Completion criteria

- `chart-interaction-composition.ts` contains assembly and teardown only, with no object/indicator kind checks.
- `PriceChartInteractionMediator` contains subscriptions and normalized event forwarding only.
- `InteractionStore` imports no chart, DOM, React, primitive, object, indicator, or drawing-kind modules.
- Every supported object interaction rule lives in its own object directory.
- Every supported indicator interaction/configuration rule lives in its own indicator directory.
- No scope-specific session remains under `_sessions/`; that directory contains generic lifecycle infrastructure and shared algorithms only.
- Current mouse, touch, creation, selection, editing, preview, configuration, persistence, cancellation, and teardown behavior is preserved.
- Focused tests pass, TypeScript introduces no new failures, and `git diff --check` passes.
