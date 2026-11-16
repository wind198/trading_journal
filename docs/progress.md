# Chart interaction store migration — progress

Track strangler slices for store-backed create/edit/select. Source of truth for intent: [tdd-chart-drawing-tool-composition.md](./tdd-chart-drawing-tool-composition.md). Update this file when a slice lands.

## Done

- [x] Generic store infra (`InteractionStore`, registry, effect runner, contracts)
- [x] `ChartCreateRuntime` — all create scopes (two-point fine/coarse, extension, polyline, one-shot)
- [x] Shared create behaviors (`TwoPointCreateBehavior`, `ThreePointCreateBehavior`, `PolylineCreateBehavior`)
- [x] Composition → create/edit/selection runtimes only; peaks removed
- [x] Primitive registry (hitBoost / draft routing)
- [x] Edit session supports `AnchorEditPhase` (legacy | store) + `StoreEditController`
- [x] Shared `TwoPointEditBehavior`
- [x] Rectangle edit via store (`RectangleBehavior.Editable`)
- [x] Trendline edit via store (`TrendlineBehavior.Editable`)
- [x] Hit-order preserved: press → primary → trendline(store) → rectangle(store) → rest → body

## Remaining — edit (store `Editable`)

Migrate one scope at a time; keep mutually exclusive with legacy `ToolEditBehavior`.

| Order | Scope | Notes | Status |
|------:|-------|-------|--------|
| 1 | Fibonacci range | anchors + **body** translation | pending |
| 2 | Warning circle | center drag keeps rim offset (not plain two-point) | pending |
| 3 | Fibonacci extension | primary phase today (`beginPrimary`) | pending |
| 4 | Polyline | primary / vertex edit | pending |
| 5 | Icon | press + threshold drag | pending |
| 6 | Text | press + threshold drag | pending |

After each scope: drop its legacy `*-edit-behavior` from registry anchors/press/primary/body; register `Editable` on edit runtime store; add runtime test.

### Edit cleanup (after all scopes)

- [ ] Remove unused legacy `ToolEditBehavior` classes / `createToolEditBehaviors` if unused
- [ ] Collapse `AnchorEditPhase` if everything is store-backed
- [ ] `DrawingEditSession` may shrink to press/hit orchestration only

## Remaining — selection / configure

- [ ] `ChartSelectionRuntime` → store `Selectable` (replace `DrawingSelectionSession`)
- [ ] Label / configure workflows → store `Configurable` where still session-based

## Remaining — composition / legacy purge

- [ ] Remove leftover creation session classes / refs / predicates if any remain
- [ ] Collapse `chart-interaction-composition.ts` to assembly + teardown
- [ ] Assert no double-handling (legacy + store) per scope

## Suggested next slice

**Fibonacci range edit** — first remaining two-point-like tool that also owns **body** drag; forces store path to cover non-anchor begin (body phase), not only `AnchorEditPhase`.

## Test command (edit slice)

```bash
npx tsx --test \
  "app/(app)/trading-dashboard/_components/chart/_sessions/edit/*.test.ts" \
  "app/(app)/trading-dashboard/_components/chart/_components/objects/rect/rectangle-behavior.test.ts"
```
