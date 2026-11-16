# Technical design: composable chart objects and indicators

**Status:** Approved architecture; migration in progress

**Scope:** Imperative chart drawing, object interaction, indicator rendering, and configuration

**Primary stack:** TypeScript, React, Lightweight Charts 5

**Audience:** Maintainers, implementers, and agents applying this pattern in this or another project

## 1. Purpose

Charting systems often begin as one imperative event handler that maps pointers, mutates drafts, updates canvas primitives, persists changes, and manages cleanup. That design becomes difficult to extend because every new object or indicator adds branches to the same coordinator.

This design separates four concerns:

1. A thin mediator owns chart and DOM subscriptions.
2. A generic store owns active workflow state and lifecycle.
3. Each object or indicator owns its business workflow rules.
4. Each primitive owns Lightweight Charts rendering and chart attachment details.

The architecture must scale by registration and composition. Adding a new scope should not require another branch in the mediator or store.

## 2. Design principles

### 2.1 Workflows are business capabilities

Shared interfaces describe what a user can do:

- create an object;
- select an object;
- edit an object;
- configure an object or indicator.

Rendering, hit testing, pointer capture, subscription cleanup, and disposal are technical mechanisms. They are not shared business capabilities. A scope may use those mechanisms internally through its ports.

### 2.2 State and rules have different owners

The interaction store owns all active state: workflow, scope, pointer ownership, phase, draft, commit, cancellation, and disposal. It treats scope state as opaque.

The scope behavior remains stateless. It receives the current scope state and an event, then returns the next state and effects. Rectangle point rules remain in the rectangle folder even though the rectangle draft is stored by the generic store.

### 2.3 Rendering stays with the scope

Each object or indicator folder owns its primitive, pane view, renderer, geometry, and scope-specific behavior. The chart handle assembles primitives; it does not implement their rules.

### 2.4 Adapters isolate frameworks

Workflow policies do not import React refs, DOM elements, Supabase, or Lightweight Charts APIs. Adapters provide normalized input and execute effects at the application boundary.

### 2.5 Reuse through composition

Two-point placement, three-point placement, tap sequences, and draft scheduling are reusable algorithms. Concrete scopes configure them. Avoid a shared base class that accumulates unrelated optional methods.

## 3. Architecture

```text
React callbacks / persistence                    Lightweight Charts primitives
             ▲                                               ▲
             │                                               │
    ports and effect adapter                         scope-owned rendering
             ▲                                               ▲
             └──────────── object / indicator behavior ──────┘
                                      ▲
                                      │ workflow transition
                                      │
DOM and chart events → thin mediator → interaction store
                         normalize      lifecycle + state
```

### 3.1 Thin mediator

The mediator owns:

- `subscribeClick` and `subscribeCrosshairMove`;
- DOM pointer and double-click listeners;
- normalized event forwarding;
- idempotent `start()` and `dispose()`.

It must not know rectangle, Fibonacci, polyline, peak, or other scope kinds. It must not calculate geometry, choose persistence callbacks, or keep workflow drafts.

### 3.2 Generic interaction store

The store owns one active workflow:

```ts
type InteractionSnapshot =
  | { status: 'idle' }
  | {
      status: 'active'
      scopeId: string
      workflow: 'create' | 'edit' | 'select' | 'configure'
      pointerId: number | null
      state: unknown
    }
```

The store begins a registered workflow, dispatches normalized events, replaces opaque state, runs effects in order, commits or cancels exactly once, notifies subscribers, and releases active work during disposal. It imports no scope, primitive, React, DOM, or chart module.

### 3.3 Business workflow interfaces

```ts
interface WorkflowScope {
  readonly id: string
}

interface Creatable<State, Input> extends WorkflowScope {
  beginCreation(input: Input): InteractionResult<State> | null
  continueCreation(state: State, event: InteractionEvent): InteractionResult<State>
}

interface Editable<State, Input> extends WorkflowScope {
  beginEditing(input: Input): InteractionResult<State> | null
  continueEditing(state: State, event: InteractionEvent): InteractionResult<State>
}

interface Selectable<State, Input> extends WorkflowScope {
  beginSelection(input: Input): InteractionResult<State> | null
  continueSelection(state: State, event: InteractionEvent): InteractionResult<State>
}

interface Configurable<State, Input> extends WorkflowScope {
  beginConfiguration(input: Input): InteractionResult<State> | null
  continueConfiguration(state: State, event: InteractionEvent): InteractionResult<State>
}
```

Scopes implement only supported workflows. A data-driven force overlay may be configurable without being creatable or editable. Empty workflow implementations are prohibited.

### 3.4 Registry

The registry adapts typed workflow interfaces to the store's type-erased boundary. Registration includes generic workflow priority where ordering is required. Priority is data; the coordinator does not contain arrays or conditionals for named tools.

### 3.5 Effects and ports

A transition may return ordered effects:

```ts
type InteractionEffect = {
  scopeId: string
  type: string
  payload?: unknown
}
```

The effect runner resolves the owning scope and applies scope-specific effects through its ports. Effects may request preview, selection, persistence, pointer capture/release, interaction locking, or configuration UI. The shared effect type must not grow a union containing every object's payload.

Scope-specific ports live beside the scope:

```ts
interface RectanglePorts {
  preview(draft: RectangleDraft | null): void
  complete(drawing: RectangleDrawing): void
  change(drawing: RectangleDrawing): void
  changeEnd(id: string): void
}
```

Ports describe what the scope needs from its host. They do not become shared capabilities.

## 4. Scope ownership

### 4.1 Drawing objects

Each object folder owns its primitive and behavior:

```text
objects/rect/
├── rectangle-primitive.ts
├── rectangle-behavior.ts
└── rectangle-behavior.test.ts
```

The behavior owns creation phases, default geometry, valid edits, selection interpretation, commit payloads, and configuration rules. The primitive owns drawing, coordinate projection, canvas hit geometry, invalidation, and selected/draft presentation.

### 4.2 Indicators

Indicators follow the same ownership rule:

```text
indicators/volume-profile/
├── volume-profile-indicator.ts
└── volume-profile-primitive.ts
```

The indicator class owns data updates and supported business workflows. The primitive owns canvas rendering. Data detection and queries remain in domain/data modules unless they are drawing-only calculations.

The current indicator layer attaches force, engulfing, volume profile, and the session grid in stable paint order and detaches them in reverse order. Peak detection was removed. The session grid is a chart guide but follows the same scoped module pattern.

## 5. Session and lifecycle semantics

### 5.1 Creation

1. The host requests `create` for a registered scope.
2. The store cancels any active workflow.
3. The scope returns initial opaque state and preview effects.
4. Pointer, click, crosshair, and confirmation events transition that state.
5. Commit clears preview and persists once; cancel clears preview without persistence.

Fine and coarse pointers are normalized inputs to the same scope workflow. They may produce different transitions, but they do not require tool-aware branches in the store.

### 5.2 Editing

Selection resolves a scope and target. The store begins its edit workflow with target data. The scope owns valid handles, body translation, and resulting geometry. Pointer release commits once. Pointer cancellation, tool switching, or chart disposal cancels and releases capture.

### 5.3 Configuration

The store holds original and draft settings as opaque scope state. Apply commits validated settings; cancel restores or discards the draft. React renders snapshots and the application owns persistence.

### 5.4 Disposal

Disposal order is explicit:

1. stop mediator subscriptions;
2. cancel and dispose the interaction store;
3. release pointer capture and scheduled previews;
4. detach primitives/listeners;
5. clear external refs.

Every `attached()` subscription in a primitive must have a matching `detached()` cleanup. Repeated cancellation and disposal are safe.

## 6. Target repository structure

```text
chart/
├── _components/
│   ├── objects/<scope>/
│   │   ├── <scope>-primitive.ts
│   │   ├── <scope>-behavior.ts
│   │   └── focused tests
│   └── indicators/<scope>/
│       ├── <scope>-primitive.ts
│       ├── <scope>-indicator.ts
│       └── focused tests
├── _sessions/
│   ├── interaction-contract.ts
│   ├── interaction-store.ts
│   ├── interaction-owner-registry.ts
│   ├── interaction-effect-runner.ts
│   └── shared placement/tap algorithms
├── chart-pointer-adapter.ts
├── chart-interaction-ports-adapter.ts
├── price-chart-interaction-mediator.ts
└── chart-interaction-composition.ts
```

The final composition file contains construction, registration, start, and reverse-order disposal only. It must remain approximately stable in size when new scopes are added.

## 7. Pipeline composition

The original implementation introduced typed `pipe` and `effect` helpers for mapping, decision, and mutation boundaries. They remain useful inside a workflow when they make its stages explicit:

```ts
const place = pipe(mapInput, decidePlacement, effect(applyPlacement))
```

Piping is an implementation tool, not the architecture boundary. The workflow interface and state ownership rules take precedence. Do not force trivial transitions into pipelines or expose RxJS-style infrastructure without a concrete asynchronous need.

## 8. Current repository status

Implemented:

- typed flow helpers and fine/coarse creation session experiments;
- object primitives moved into per-object folders;
- edit rules moved beside their owning objects;
- stateful creation, edit, selection, and configuration modules under `_sessions/`;
- thin subscription-only `PriceChartInteractionMediator`;
- pointer and preview scheduler adapters;
- indicator primitives and behavior classes moved into per-indicator folders;
- `IndicatorLayer` for ordered attachment, updates, and idempotent detach;
- generic workflow contracts, registry, effect runner, and interaction store;
- `ChartCreateRuntime` owns fine + coarse create for two-point shapes, fib extension, polyline, and one-shot icons/text via one `InteractionStore`;
- `TwoPointCreateBehavior` / `ThreePointCreateBehavior` / `PolylineCreateBehavior` hold create policy;
- coarse confirm logic is pure (`coarse-*-confirm.ts`); session class wrappers removed;
- composition wires `ChartCreateRuntime` + `ChartEditRuntime` + `ChartSelectionRuntime` only;
- chart primitive registry for hitBoost/draft routing;
- peak indicator / tuning / configuration removed;
- `ChartEditRuntime` routes trendline + rectangle anchors through `InteractionStore` + shared `TwoPointEditBehavior` (`TrendlineBehavior` / `RectangleBehavior`); other tools stay on legacy `ToolEditBehavior` via `AnchorEditPhase` hit-order (press → primary → trendline(store) → rectangle(store) → rest → body).

Migration still required:

- remaining edit scopes still use legacy `ToolEditBehavior` (fib range, warning circle, extension, polyline, icon, text);
- `ChartSelectionRuntime` still wraps `DrawingSelectionSession` (not yet `Selectable` / store);
- fold remaining edit/selection onto store workflows one scope at a time.

This status section must be updated with every completed migration slice. Do not describe a foundation as active runtime behavior until chart events use it.

## 9. Migration strategy

Use a strangler migration:

1. Characterize current event order and cancellation behavior.
2. Keep the generic store covered with framework-free tests.
3. Route rectangle creation and editing through the store as the first vertical slice.
4. Migrate two-point objects, then Fibonacci extension, polyline, icon, and text.
5. Migrate selection and configuration workflows.
6. Remove legacy sessions, registries, refs, predicates, and routing branches.
7. Collapse the composition root to assembly and teardown.

Legacy and new paths must be mutually exclusive for each scope. A development assertion or integration test must detect double event handling.

## 10. Testing requirements

### Generic infrastructure

- workflow replacement cancels the previous scope first;
- stale pointer IDs are rejected;
- state snapshots and effects preserve order;
- commit and cancel occur exactly once;
- disposal cancels active work and rejects further dispatch;
- registry priority is generic workflow data.

### Scope behavior

- creation and edit phases;
- fine and coarse input where supported;
- preview and persistence payloads;
- selection/hit interpretation;
- reverse and zero-size geometry where currently accepted;
- configuration validation, apply, and cancel;
- thrown port/effect behavior is explicit.

### Integration and rendering

- listener and pointer capture cleanup;
- chart recreation leaves no active workflow or scheduled preview;
- scroll/zoom locking matches current behavior;
- primitive input updates call `requestUpdate()`;
- pane/series primitive detach reverses attached subscriptions;
- visual behavior, visibility gates, and paint order remain unchanged.

The repository currently has unrelated TypeScript errors in `non-trade-warning-banner.tsx`. Report them separately; do not treat them as validation of chart changes.

## 11. Anti-patterns

Avoid:

- a composition factory that contains every workflow;
- mediator or store switches over scope kinds;
- centralized edit geometry;
- shared technical “capabilities” such as renderable, hit-testable, or disposable;
- stateful object behaviors competing with the generic store;
- empty workflow methods on unsupported indicators;
- React refs as a second source of interaction state;
- a base class that grows optional hooks for unrelated scopes;
- moving domain detection or persistence into canvas primitives;
- creating abstractions without a migrated vertical slice proving them.

## 12. Applying this design elsewhere

Start with one complete scope, not a framework-wide rewrite:

1. identify its user workflows;
2. put rendering and rules beside the scope;
3. define narrow host ports;
4. centralize active state in a generic store;
5. normalize host events in a thin mediator;
6. register the scope by workflow;
7. prove commit, cancel, replacement, and disposal;
8. migrate the next scope only after the first path is simpler to trace.

The reusable idea is the ownership model, not the exact filenames: infrastructure owns lifecycle, scopes own business decisions, adapters own technology, and primitives own drawing.
