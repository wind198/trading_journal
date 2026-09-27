# 002 — Journal screens under `/journal`

## Context

Trades, discipline, and quotes were sibling URLs. A chart dashboard needs the full viewport, not the narrow journal shell.

## Decision

Signed-in journal pages live under `/journal` (`/journal`, `/journal/discipline`, `/journal/quotes`). `/trading-dashboard` is a sibling route and skips the journal shell. Both stay behind the same auth layout.

## Alternatives

- Leave `/discipline` and `/quotes` at the top level.
- Put the 2x2 chart grid inside the journal shell.

## Consequences

- New journal screens are added under `app/(app)/journal/`.
- Tab links and the date toolbar must use the `/journal/...` paths.
