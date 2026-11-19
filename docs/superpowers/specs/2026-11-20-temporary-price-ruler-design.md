# Temporary Price Ruler Design

Add an expanded-pane-only ruler button for measuring vertical EURUSD price distance. The ruler is temporary, never persisted, and displays signed price delta, pips, and percentage.

Use a dedicated series primitive and measurement controller. Fine pointers place the first endpoint, preview with movement, and complete on the second click. Coarse pointers follow the existing seeded two-point flow: viewport-center seed, drag active endpoint, tap to confirm, then repeat. The next click or tap away clears the completed ruler. Tool cancellation, another drawing tool, Escape, pane collapse, pointer cancellation, and chart disposal also clear it.

The primitive must not affect autoscale or enter the saved drawing model. One EURUSD pip is `0.0001`; percentage is relative to the first price. No time/bar distance, persistence, selection, or edit handles are included.
