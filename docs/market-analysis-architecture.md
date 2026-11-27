# Market Analysis / Risk Sentinel — target architecture

Status: approved direction; implementation staged. The existing dashboard remains unchanged. This PR specifies the analytical foundation, not a working agent or UI.

## Scope
EURUSD, M3 and M15 initially; user-triggered scan only. Warn about market risks, not entry recommendations, price predictions or order execution. No warning is not a clearance to trade. Behavioral and position-specific checks require additional data and are deferred.

## Components
- app/(app)/market-analysis: independent workspace with chart panes for M3/M15, overview/trend/range/transition views, numerical inspector, tool execution status and risk report. Manual scan button. Display stale, partial, loading and failed states explicitly. Follow repository UI skills before implementation.
- lib/market-analysis: pure TypeScript indicator adapters, features, classifiers, tools and versioned configuration; independent of SDK and React. Reuse existing lib/ticks Ichimoku and existing baseline/force/volume profile implementations after source-level parity review; extract shared pure calculations rather than importing dashboard state.
- lib/agents/trading-risk: server-only @openai/agents integration, Zod tools and output, context loader, budgets, evidence validation and repository.
- app/api/market-analysis/scan: authenticated POST; Node runtime, SSE progress and terminal validated result. GET runs/[id] for owned history. No order tools. Keep API key server-side. Check SDK Node requirements, dependency versions and hosting request limits before implementation.
- Supabase: existing market data; analysis_runs (owner, snapshot, model, config and knowledge versions, status, timestamps), analysis_tool_results (run, tool/version, timeframe, inputs, outputs, duration), analysis_risk_findings (run, severity, evidence IDs), analysis_feedback (owner, finding, label/comment). Foreign keys, owner-scoped RLS and retention; server validates ownership even with privileged credentials. No vector database, Redis, MCP, worker or scheduler initially.

## Scan sequence
1. Validate identity, symbol, timeframes and bounded request; rate-limit per user and reject overlapping scans.
2. Freeze completed OHLC bars as of a common UTC timestamp, record source and immutable snapshot or exact hash plus retained data. M3/M15 calculated independently.
3. Calculate foundation features and classify regimes; execute mandatory common and applicable regime tools deterministically (both range/trend where ambiguous).
4. Load fixed policy plus knowledge by explicit IDs from versioned local files; no semantic search. Treat notes as observations, not instructions. Bundle knowledge with server deployment.
5. One Agents SDK agent receives compact results, may invoke bounded read-only high-level tools using RunContext containing frozen snapshot/config and cached results. No arbitrary SQL or external fetch.
6. Stream progress, not raw private reasoning. Validate structured findings against actual evidence, reject unsupported IDs, invalid numbers or entry recommendations. Show unknown/partial if evidence missing; never silently report safe.
7. Persist results and render charts from the same analysis artifact; chart overlays use exact input bars and feature series. Handle disconnect/cancellation, timeouts and bounded retries; never imply background completion.

## Workspace isolation
Share data, pure indicator libraries and reusable chart primitives only. Independent viewport, settings, stores, configuration and lifecycle. Future dashboard integration via versioned report contract, optional and non-blocking.

## Operations
Set explicit max turns, token/time limits, tool concurrency and history bounds; redact sensitive account/journal data from SDK tracing, disable sensitive tracing where appropriate. Log run ID, versions, errors and latency. Model selection and deployment limits TBD. No runtime dependencies added in this specification PR.

## Delivery gates
1. Contracts/catalog and workspace architecture (this PR).
2. Pure indicator adapters and golden fixture tests, classification and deterministic tools.
3. Separate workspace with replay and evidence visualization.
4. SDK runner, API, Supabase migrations and security tests.
5. Calibrate thresholds using chronological replay and manually labeled risk events; measure warning precision/recall, false reassurance and duplicate warnings. Future behavioral data and dashboard integration optional.

References: https://openai.github.io/openai-agents-js/ ; https://tradingview.github.io/lightweight-charts/ ; https://supabase.com/docs/guides/database/postgres/row-level-security
