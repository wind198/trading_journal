# Indicator drawing composition plan

## Goal

Move the chart drawing logic in `app/(app)/trading-dashboard/_components/chart/primitives/` into focused modules under `app/(app)/trading-dashboard/_components/chart/_components/indicators/`. Give each indicator its own behavior class, following the drawing-object folders: the class owns that indicator's drawing and rules for any supported creation, editing, or configuration. Stateful interaction lifecycles belong in `_sessions/`. Leave `price-chart-handle.ts` responsible for chart assembly and `price-chart.tsx` responsible for passing changing inputs.

This is a structural refactor. The overlays' appearance, visibility, data calculations, and update timing should stay the same.

## Current boundaries

| Primitive | Lightweight Charts attachment | Inputs | Proposed home |
| --- | --- | --- | --- |
| `force-overlay-primitive.ts` | Price series | Force events | `indicators/force/` |
| `engulfing-overlay-primitive.ts` | Price series | Engulfing events | `indicators/engulfing/` |
| `peak-overlay-primitive.ts` | Price series | Peak events and bars | `indicators/peaks/` |
| `volume-profile-primitive.ts` | Price series | Profile and bars | `indicators/volume-profile/` |
| `session-vertical-lines-primitive.ts` | Chart pane 0 | Bars and visible logical range | `indicators/session-grid/` |

Session lines are a chart time guide rather than a computed indicator. They belong in this migration because they are the remaining pane primitive in `primitives/`; keep the `session-grid` name explicit.

The dashboard's force, engulfing, peak, and volume-profile calculations remain outside these drawing modules. Existing domain helpers in `_lib/overlays/` and `_lib/chart/` remain the source of event and profile data. Peak settings UI remains outside the canvas renderer. Move a helper into an indicator folder only when it is used solely to lay out or paint that indicator.

## Target shape

Each folder owns its primitive, pane view, renderer, indicator behavior, drawing-only types, and focused tests. The behavior class is the indicator's entry point for updates and any supported interactions; the primitive remains the Lightweight Charts canvas adapter. Keep a file together while it is small; split a renderer or geometry helper only when that makes the drawing code easier to follow. Do not create a shared base class for five different rendering contracts.

### Target project structure

```text
app/(app)/trading-dashboard/
├── _components/chart/
│   ├── _components/
│   │   ├── indicators/
│   │   │   ├── indicator-layer.ts
│   │   │   ├── force/
│   │   │   │   ├── force-indicator.ts
│   │   │   │   └── force-overlay-primitive.ts
│   │   │   ├── engulfing/
│   │   │   │   ├── engulfing-indicator.ts
│   │   │   │   └── engulfing-overlay-primitive.ts
│   │   │   ├── peaks/
│   │   │   │   ├── peak-indicator.ts
│   │   │   │   └── peak-overlay-primitive.ts
│   │   │   ├── volume-profile/
│   │   │   │   ├── volume-profile-indicator.ts
│   │   │   │   └── volume-profile-primitive.ts
│   │   │   └── session-grid/
│   │   │       ├── session-grid-indicator.ts
│   │   │       └── session-vertical-lines-primitive.ts
│   │   └── objects/                  # Existing interactive drawing tools
│   ├── _sessions/
│   │   ├── create/                   # Active placement/creation lifecycle
│   │   ├── edit/                     # Active selection and edit lifecycle
│   │   └── configure/                # Draft, apply, cancel lifecycle
│   │       └── peak-configuration-session.ts
│   ├── price-chart-handle.ts        # Chart creation; calls indicator layer
│   └── price-chart.tsx              # React input effects; calls indicator layer
└── _lib/
    ├── overlays/                    # Event detection and overlay domain data
    └── chart/                       # Volume-profile and timezone calculations
```

`chart/primitives/` is removed after its five files have moved. The tree shows the required files; add local tests or extracted helpers beside their owning primitive when an implementation needs them, rather than creating empty files in advance.

### File ownership after refactor

| File | Owns | Public surface used outside its folder |
| --- | --- | --- |
| `indicators/<name>/<name>-indicator.ts` | Indicator-specific behavior: input updates, visibility, and supported interaction/configuration rules; delegates painting to its primitive | Indicator class used by `indicator-layer.ts` |
| `indicators/force/force-overlay-primitive.ts` | Force event type, marker layout, pane view, canvas renderer, primitive lifecycle | `ForceOverlayEvent` for chart props; primitive used by its indicator |
| `indicators/engulfing/engulfing-overlay-primitive.ts` | Engulfing event type, marker layout, pane view, canvas renderer, primitive lifecycle | `EngulfingOverlayEvent` for chart props; primitive used by its indicator |
| `indicators/peaks/peak-overlay-primitive.ts` | Peak event type, bar-to-marker layout, pane view, canvas renderer, primitive lifecycle | `PeakOverlayEvent` for chart props; primitive used by its indicator |
| `indicators/volume-profile/volume-profile-primitive.ts` | Profile-to-canvas layout, pane view, canvas renderer, primitive lifecycle | Primitive used by its indicator |
| `indicators/session-grid/session-vertical-lines-primitive.ts` | Session-line layout, pane view, canvas renderer, pane primitive lifecycle, range listener | Primitive used by its indicator |
| `indicators/indicator-layer.ts` | Creation order, conditional attachment, input forwarding and teardown of indicator classes | One `IndicatorLayer` interface/factory used by the chart handle and React effects |
| `_sessions/create/`, `_sessions/edit/`, `_sessions/configure/` | Active state, transitions, cancellation and commit for indicator interactions, using the existing session pattern | Session contracts called by the mediator/React UI |

Keep the private renderer and pane-view classes in each primitive file initially, as they are today. If volume-profile layout warrants a separate file, name it `volume-profile-layout.ts` within the same folder; it should convert chart inputs to drawable geometry and contain no chart attachment or React state. The same rule applies to any later extracted layout helper. Shared candle marker layout stays in `_lib/chart/candle-overlay-layout` while force and engulfing both use it.

### Interaction and session ownership

Follow the same split as `_components/objects/` and `_sessions/`: each indicator folder owns its behavior class and any indicator-specific creation, hit-test, edit, or configuration policy. A shared session owns the active interaction state and calls those policies through a small port. The chart interaction mediator routes events to the active session; it does not implement indicator geometry or settings rules. Keep persistence and React form rendering outside the behavior and session classes.

| Indicator | Current interaction | Session integration to plan for |
| --- | --- | --- |
| Force | Data-driven overlay | Configuration session if visibility/style controls are introduced; no pointer creation/edit session now |
| Engulfing | Data-driven overlay | Configuration session if visibility/style controls are introduced; no pointer creation/edit session now |
| Peaks | Data-driven overlay with tuning controls | Move unsaved tuning draft/apply/cancel state into `_sessions/configure/`; peak behavior owns validation/defaults and how applied settings affect its drawing |
| Volume profile | Data-driven overlay | Configuration session for any existing or future display settings; creation/edit session only if the product supports an anchored profile |
| Session grid | Chart time guide | Configuration session for visibility/style if exposed; no pointer creation/edit session now |

Do not create inert creation or edit classes for data-driven indicators. When an indicator gains a user-placed or editable form, add its policy beside that indicator (for example `<name>-creation-behavior.ts` or `<name>-edit-behavior.ts`) and register it with the appropriate `_sessions/create/` or `_sessions/edit/` coordinator. The coordinator owns pointer capture, cancellation and commit; the indicator owns placement, hit testing, geometry changes, and valid settings. This keeps future indicator interactions as scoped as the object behaviors.

The chart handle should compose these modules through a small indicator-layer API, for example `attachIndicators(...)`, `setBars(...)`, `setForceEvents(...)`, `setEngulfingEvents(...)`, `setPeakEvents(...)`, `setVolumeProfile(...)`, and `detach()`. This API should hold only chart attachment and input forwarding. Primitive classes should continue to own `attached`/`detached`, pane views, invalidation, and drawing. Keep the distinction between series primitives and the session-grid pane primitive in the types.

Preserve the current creation rules: force and engulfing attach to the price series; peak, volume profile, and session lines attach only for the timeframes currently supported by `price-chart-handle.ts`. Preserve attachment order, the shared candle-overlay layout/stacking behavior, and the session grid's vertical-grid setting.

## Implementation slices

### 1. Establish behavior baseline and move event overlays

1. Record the current input and attachment paths in `price-chart-handle.ts` and `price-chart.tsx`, including `setEvents` calls and chart recreation.
2. Move force and engulfing primitives into `indicators/force/` and `indicators/engulfing/`. Keep their public event types near their owning modules and update imports in `price-chart.tsx` and the handle.
3. Preserve the existing candle overlay layout and event stacking. Add focused tests only for behavior that can regress through the move, such as geometry or ordering, using existing test conventions.
4. Verify force and engulfing still repaint when their event inputs change.

### 2. Move bar-dependent overlays

1. Move peak and volume-profile primitives into `indicators/peaks/` and `indicators/volume-profile/`.
2. Keep `setBars`, `setEvents`, and `setProfile` behavior, coordinate handling, and visible-range clipping intact. Preserve the current `syncDrawingBars()` path until the indicator layer is assembled.
3. Keep the profile calculation and peak-event calculation outside the renderer. Add focused tests for any extracted drawing geometry, especially empty input and coordinates outside the visible chart.

### 3. Move the session grid

1. Move the pane primitive into `indicators/session-grid/`; keep its attachment to pane 0 and its current timeframe gate.
2. Keep visible-logical-range subscription in `attached()` and the matching unsubscribe in `detached()`. Verify that chart recreation does not accumulate listeners.
3. Preserve timezone-derived line times, drawing at the bottom pane layer, and the current standard-grid visibility rule.

### 4. Compose and clean up

1. Add the five indicator behavior classes and a small indicator-layer composition module under `indicators/`. The layer creates, attaches, updates, and detaches indicators without owning their rendering or interaction rules.
2. Replace the five primitive fields and repeated update calls in `ChartHandle`/`PriceChart` with this composition API. Keep `price-chart-handle.ts` as chart assembly, not an indicator behavior class.
3. Move peak tuning draft state, if it currently lives in React, into a focused `_sessions/configure/peak-configuration-session.ts`; keep its form and persistence at the existing UI boundary. Add creation/edit session registrations only for indicator interactions that actually exist.
4. Move any drawing-only helpers from `chart/primitives/` into the owning folders, remove stale imports, and remove `chart/primitives/` once empty. Replace the placeholder `indicators/README.md` with a short ownership map or remove it if the folder structure is self-explanatory.

## Verification and completion criteria

- Run focused chart tests, TypeScript checking, and `git diff --check`; report any unrelated existing failures separately.
- Check 3m and 15m charts and another timeframe: the same overlays appear under the same conditions and in the same order.
- Check force/engulfing event updates, peak markers, volume-profile alignment, session lines, scroll/zoom, chart recreation, and empty or missing data. Check a high-density display if available.
- Confirm each primitive still requests a redraw when its inputs change, guards unavailable chart coordinates, and leaves the canvas state intact after drawing.
- Confirm no indicator drawing logic remains in `chart/primitives/`, and no indicator-specific rendering or edit behavior is added to `price-chart-handle.ts` or the interaction mediator.
- Confirm an indicator's policy remains in its own folder, while any active creation, edit, or configuration draft is held by `_sessions/` and is released on cancel, tool switch, or chart teardown.
