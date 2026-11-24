# Workspace composition — PR 02

The route entry remains TradingDashboard. TradingWorkspace owns layout state, settings, notes/guide visibility, and per-pane configuration; WorkspaceToolbar renders commands with explicit callbacks; WorkspaceLayout selects existing CSS grid classes; ChartPane owns existing market and drawing lifecycle; ChartPaneHeader renders existing pane controls. The pure workspace layout model determines visible panes and layout mode. No global store or new dependency.

Mobile remains two/four simultaneously visible panes: portrait 1×2/1×4, landscape 2×1/2×2, compact single toolbar and zero outer padding. Keep existing chart sessions and indicators intact. This change intentionally does not lift drawing tool state out of ChartPane; the shared drawing toolbar is a separate change.

Validation: pnpm test:workspace; pnpm build; existing chart tests and browser checks in docs/ui-design-system.md. Verify expansion/collapse in both modes, chart-type selection, reset, notes, fullscreen, chart drawing and persistence. No browser evidence is claimed without execution.
