# Trading Journal UI design system — PR 01

## Direction
Chart-first, compact and calm. Use the existing fonts, shadcn primitives and Lucide; no new runtime dependencies. The authenticated shell owns navigation and sign-out; feature routes own their tools. Only existing Workspace and Calculator routes are exposed.

## Tokens
Use semantic CSS variables in globals.css rather than hardcoded component colors. Light is active; dark tokens are reserved until all canvas/indicator primitives are audited. Market direction colors must remain distinguishable from action colors. Use 4–6px radii, 1px separators, 4/8/12/16/24px spacing, 36–44px toolbars, tabular financial values. Use shadows for floating surfaces only. Preserve chart palette and algorithms in PR 01.

## Ownership
AppShell supplies the viewport and scrollable route region. Workspace fills the available height and signals fullscreen via data-workspace-fullscreen; shell header hides while fullscreen is active. Calculator scrolls within the shell. AppNavLinks is the existing route registry. New features should only add navigation once implemented. Use existing shared primitives, not speculative abstractions.

## Regression checklist
- Both routes reachable at 320, 390, 768, 1280 and 1440px.
- Workspace controls occupy one 37px row on compact screens; application menu is included, no duplicate header. No viewport overflow.
- Fullscreen hides app header and restores on exit; workspace toolbar and drawing tools remain accessible.
- Calculator inputs and stored values unchanged; sign-out remains available.
- Four panes, focus, expand, overlays, drawings, notes, polling and persistence unchanged.
- Keyboard focus, reduced motion, accessible icon labels.
- Run pnpm build and pnpm test:ticks, existing chart interaction tests, then capture before/after screenshots with authorized test data.
- Dark mode activation, shared drawing toolbar, resizable panes, inspector and further mobile interaction refinements are later PRs.

## Mobile density contract
Two and four simultaneously visible charts are core requirements, not optional desktop-only features. Portrait phones use 1×2 or 1×4; landscape and widths >=768px use 2×1 or 2×2. One-pixel dividers, zero outer grid padding, overlay timeframe/bias labels. Compact workspace uses one 37px toolbar; navigation and sign-out move into its application menu. Chart type, refresh and reset share an actions menu. Explicit fullscreen retains the compact workspace toolbar and replaces the enter button with an exit button; global application chrome stays hidden. Pinned notes do not automatically cover charts on compact screens. Keep existing axis visibility policy and drawing sessions. Test 320×568, 390×844, 844×390 and tablet layouts; verify all requested panes visible, controls reachable and no clipped chart canvas. Mobile expanded drawing controls scroll horizontally instead of wrapping. Touch controls target 36px on the workspace toolbar; pane expand uses 32px. Validate touch usability in browser before release.
