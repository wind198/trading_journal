# Phase 2b — numerical tools and shared adapters

Extract existing Force Score, candle features, default configuration and volume profile computation to lib/market-indicators. Existing dashboard paths re-export identical implementations; no rendering or order behavior intentionally changed. Force score time conversion uses shared timeframe seconds; warmup and missing values remain explicit. Tick profiles require externally acquired, snapshot-bound tick-count bins; no database migration and no fabricated OHLC volume distribution.

Confirmed pivots use strict extrema and confirmation time; historical range excludes current bar and is explicitly NOT a validated channel. User-supplied windows are required, not calibrated defaults. Initial tools: volatility, trend strength, trend extension, observed range position and momentum, per timeframe. Regime stays unknown; no false classification. Evidence covers full supplied timeframe history (including Wilder warm-up); report window parameters must be persisted alongside config and snapshot. No position or behavioral conclusions.

Remaining: calibrated classifier policy, structural range validation, key-level tests, cross-timeframe alignment, explicit regime-specific dispatch, tick-profile acquisition and chart workspace. No live scan or SDK integration yet.

Run pnpm test:market-analysis and existing dashboard indicator tests before merge. M3 feed migration not needed per owner; no migration included.
