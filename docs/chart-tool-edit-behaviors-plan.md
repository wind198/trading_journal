# Chart tool edit behaviors: action plan

**Status:** Implemented; browser gesture review pending  
**Scope:** Editing existing drawings in the trading dashboard  
**Starting point:** `DrawingEditBehavior` currently owns pointer lifecycle and every tool's hit testing and geometry rules.

## Goal

Give each drawing tool ownership of its edit rules. Keep one small coordinator for active pointer lifecycle, capture, cancellation, and callback completion. Preserve selection order, editing gestures, callback payloads, and placement behavior.

This plan changes editing only. The existing fine and coarse placement sessions stay in place. Rendering primitives remain responsible for drawing and hit-test geometry; tool edit behaviors use them through narrow ports.

## Ownership and contract

| Owner | Responsibility |
| --- | --- |
| `PriceChartInteractionMediator` | Register and remove chart and DOM listeners; forward pointer events |
| `DrawingEditCoordinator` | Ask tool behaviors for an edit, own the single active session and pointer ID, capture/release, interaction lock, and exactly one end callback |
| Tool edit behavior | Determine whether its selected drawing can be edited at the pointer location; create a session that owns its tool-specific geometry and state |
| Tool edit session | Map each valid drawing point to a proposed change; retain the latest geometry needed by the next move |
| Composition root | Construct tool behaviors with primitive adapters and live data/callback ports; specify explicit hit priority |

Use a common contract for routing, with a discriminated change result so the coordinator does not need tool-specific callback branches:

```ts
type EditChange =
  | { kind: 'two-point'; id: string; p1: DrawingPoint; p2: DrawingPoint }
  | { kind: 'polyline'; id: string; points: DrawingPoint[] }

interface ToolEditSession {
  readonly id: string
  readonly changeKind: EditChange['kind']
  move(point: DrawingPoint): EditChange | null
}

interface ToolEditBehavior {
  begin(input: {
    selectedId: string
    screen: ScreenPoint
    chartPoint: DrawingPoint | null
  }): ToolEditSession | null
}
```

The coordinator maps the pointer to a chart point once per move, invokes the active session, then dispatches its result through the existing change ports. A `null` result means no change or an unmappable move. `begin` performs no capture or document callback; the coordinator owns those effects after a session is accepted. Keep hit tests in the relevant tool behavior, using the existing primitive APIs. The tool behavior must reject temporary IDs and hits for a different selected drawing.

The contract may be refined while implementing the first tool, but every tool should satisfy the same lifecycle. Avoid a base class with empty hooks. Share small geometry helpers only when two tools actually need the same calculation.

## Tool rules to preserve

| Tool | Edit rule | Special gesture |
| --- | --- | --- |
| Trendline | Move either anchor | None |
| Rectangle | Move either anchor | None |
| Fibonacci range | Move either anchor or translate both points from a body hit | Body hit must retain its current priority |
| Warning circle | Move rim anchor; moving center translates rim by the same delta | Center and rim stay aligned |
| Icon | Move its single point | Select on press, begin drag only after movement threshold |
| Text anchor | Move its single point | Same press threshold as icon; label edit remains selection behavior |
| Fibonacci extension | Move one vertex or translate all three points | Body hit starts whole-shape movement |
| Polyline | Move a hit vertex | Preserve point order and unchanged vertices |

The icon/text threshold is a **pending press**, distinct from an active edit session. Put its selection and threshold handling in a shared press gesture collaborator or in the coordinator. The tool behaviors still decide which icon/text drawing is hit and create their own edit session when the threshold is crossed. Do not let each tool capture the same pointer independently.

## Migration sequence

### 1. Lock down the current behavior

Extend focused tests around the existing `DrawingEditBehavior`: selected-ID matching, equal-distance or overlapping hit priority, icon/text press threshold, anchor edits, whole Fibonacci range movement, warning circle center movement, extension whole/vertex movement, polyline vertex movement, unmappable moves, pointer cancellation, tool switch, and completion callback count/order. Reuse the current integration harness where it catches event routing and synthetic click suppression.

### 2. Introduce the coordinator and extract warning circle

Define `ToolEditBehavior`, `ToolEditSession`, and `EditChange`. Move pointer lifecycle into `DrawingEditCoordinator`. Implement `WarningCircleEditBehavior` first because its center translation is a clear tool-specific rule. Keep all other branches behind a temporary legacy adapter so this step changes one behavior at a time. Prove the coordinator handles capture, lock, change, up, cancel, and disposal exactly once.

### 3. Extract the remaining tools in stable groups

1. Trendline and rectangle: use one shared two-anchor geometry helper, with separate tool behavior instances and primitive ports.
2. Fibonacci range: add body translation and preserve the previous anchor/body precedence.
3. Icon and text: move their hit lookup and one-point edit sessions; keep the shared pending-press threshold in one owner.
4. Fibonacci extension and polyline: add vertex sessions and whole-extension translation, using the polyline change port.

After each group, remove the corresponding branch from the legacy adapter and run its focused tests. Remove the adapter when all tools are covered. The coordinator should have no primitive-name checks, drawing array search, endpoint geometry calculation, or tool-specific state fields.

### 4. Wire composition and remove redundant state

Build the behavior list in `chart-interaction-composition.ts` with explicit order matching today's hit precedence. Pass narrow live getters or primitive adapters to each behavior. Keep `PriceChart` and the mediator unaware of individual tool edit classes. Remove `DrawingDragState`, `PolylineDragState`, and broad `drawings()` lookup when no longer used. Leave placement sessions and selection behavior unchanged except for any necessary routing boundary.

### 5. Verify and review

Run focused edit, interaction, and placement tests, `tsc --noEmit --incremental false`, and `git diff --check`. Check one real mouse edit and one touch edit in the dashboard, including cancellation and tool switch. The existing TypeScript errors in `non-trade-warning-banner.tsx` are outside this refactor and should be reported separately if still present.

## Acceptance criteria

- Each tool's hit eligibility and geometry change can be found in its tool behavior, independent of the coordinator.
- One active edit session and pointer ID exist at a time. Capture is released on up, cancel, tool switch, and disposal.
- An accepted edit ends once through the correct callback; a pending press or unmappable move emits no edit change.
- Existing hit priority, callback payloads, preview behavior, and synthetic click suppression remain unchanged.
- The mediator only owns subscriptions and routing; the coordinator only owns edit lifecycle.
- Placement workflows and persistence contracts do not change.

## Review gate after the first tool

Before moving the other tools, inspect the warning circle implementation and coordinator API. If the coordinator still needs a `warning_circle` branch, or the behavior needs the entire `PriceChartInteractionRefs` object, narrow the contract before continuing. Keep the user's existing `fibonacci-range-primitive.ts` change untouched.

## Implementation record

Each folder in `_components/objects/` owns its edit behavior class. `_sessions/edit/` contains the shared edit contract, explicit priority registry, and `DrawingEditSession`, which coordinates the active edit and pending press. `chart-interaction-composition.ts` creates the tool set and passes it to the session. The tool switch path cancels an active edit before releasing capture.

Focused automated tests pass for the tool rules and existing interaction paths. Manual mouse and touch review in a browser remains pending. The project TypeScript check still reports only the existing `non-trade-warning-banner.tsx` errors.
