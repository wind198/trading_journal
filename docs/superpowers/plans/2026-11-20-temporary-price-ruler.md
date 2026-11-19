# Temporary Price Ruler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a temporary expanded-pane price ruler for desktop and tablet.

**Architecture:** Keep measurement outside persisted drawing types. A pure state controller drives a dedicated Lightweight Charts series primitive, while `DashboardPane` owns toolbar activation and mutual exclusion with saved drawing tools.

**Tech Stack:** React 19, TypeScript, Lightweight Charts 5.2.1, Lucide React, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-20-temporary-price-ruler-design.md`

## Global Constraints

- Use the active checkout as explicitly requested by the user.
- Do not modify database schemas or persisted `ChartDrawingKind` values.
- Preserve the existing fine/coarse two-point interaction semantics.

## Review Focus

- Zero or invalid starting prices must not produce `NaN` or `Infinity` labels.
- Pointer cancellation must restore chart pan and zoom.
- Completed measurements must clear on the next away click/tap without immediately starting another.
- Selecting a saved drawing tool must clear and deactivate the ruler.
- Primitive cleanup must not leave listeners or overlays after chart recreation.

---

### Task 1: Measurement model and formatting

**Files:**
- Create: `app/(app)/trading-dashboard/_components/chart/_components/objects/measure/price-measurement.ts`
- Test: `app/(app)/trading-dashboard/_components/chart/_components/objects/measure/price-measurement.test.ts`

- [ ] Write failing tests for signed delta/pips/percentage formatting and fine/coarse state transitions.
- [ ] Run the test and confirm it fails because the module is absent.
- [ ] Implement the pure formatting and controller functions.
- [ ] Run the test and confirm it passes.

### Task 2: Measurement primitive and chart interaction

**Files:**
- Create: `app/(app)/trading-dashboard/_components/chart/_components/objects/measure/price-measurement-primitive.ts`
- Modify: `app/(app)/trading-dashboard/_components/chart/price-chart-handle.ts`
- Modify: `app/(app)/trading-dashboard/_components/chart/price-chart.tsx`

- [ ] Write failing geometry/state tests for vertical rendering inputs and dismissal behavior.
- [ ] Attach a non-autoscaling series primitive and wire fine/coarse pointer events, locking and cleanup.
- [ ] Run targeted tests and typecheck.

### Task 3: Expanded-pane toolbar integration

**Files:**
- Modify: `app/(app)/trading-dashboard/_components/dashboard/trading-dashboard.tsx`

- [ ] Add the expanded-only `Ruler` button and ruler state.
- [ ] Make ruler and saved drawing tools mutually exclusive and clear on collapse.
- [ ] Run targeted tests, lint, typecheck, and production build.
