# Shared drawing toolbar — PR 03

Select the active timeframe by tapping a pane or its label. The blue inset outline identifies the target. The existing workspace toolbar adds one drawing menu; no extra row or rail. Existing tools and marker definitions are reused. Switching panes, changing layout or entering fullscreen cancels the armed tool; drawings remain persisted by symbol/timeframe. Selecting a tool again cancels it. Delete shortcuts operate only on the active chart. The chart engine retains pointer and touch-confirmation sessions.

Fullscreen remains a chart-only mode; exit fullscreen to choose a new tool. No new drawing geometry (parallel channel, ray, horizontal line) is introduced in this slice.

Run pnpm test:workspace and pnpm build; manually exercise 2/4 pane drawing, coarse-pointer confirmation, switching during draft, selection/delete isolation, expansion, fullscreen, persistence and 320px toolbar reachability.
