# Shared drawing toolbar — PR 03

Select the active timeframe by tapping a pane or its label. The blue inset outline identifies the target. The existing workspace toolbar adds one drawing menu; no extra row or rail. Existing tools and marker definitions are reused. Switching panes or changing layout cancels the armed tool; drawings remain persisted by symbol/timeframe. Selecting a tool again cancels it. Delete shortcuts operate only on the active chart. The chart engine retains pointer and touch-confirmation sessions.

Fullscreen hides the application shell and warning banner but retains the shared workspace toolbar, including drawing tools and an exit fullscreen button. Entering or leaving fullscreen preserves active pane and drawing mode. No new drawing geometry (parallel channel, ray, horizontal line) is introduced in this slice.

Run pnpm test:workspace and pnpm build; manually exercise 2/4 pane drawing, coarse-pointer confirmation, switching during draft, selection/delete isolation, expansion, fullscreen, persistence and 320px toolbar reachability.
