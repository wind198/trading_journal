# 003 — Server-side tick fetch, Lightweight Charts candles

## Context

The dashboard needs EURUSD prices from the Supabase `ticks` table. Rows are bid/ask ticks with millisecond timestamps. Lightweight Charts wants unique candlesticks in Unix seconds.

## Decision

Read the latest 256 rows per pane from the Supabase `candles` table (`5m`, `15m`, `1h`, `4h`) with `SUPABASE_SECRET_KEY`. `time` is `bucket_start` in Unix seconds.

## Alternatives

- Query `ticks` from the browser with the publishable key.
- Plot raw ticks without aggregation (duplicate times within one second).

## Consequences

- `pnpm test:ticks` needs the real project credentials in `.env`.
- The secret key stays out of client bundles.
- Chart UI should consume the candle shape, not tick rows.
