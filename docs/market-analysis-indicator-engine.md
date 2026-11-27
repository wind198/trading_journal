# Indicator engine — phase 2a

Pure foundation series: ATR, DMI/ADX, efficiency ratio, Bollinger, Ichimoku and OLS regression. Shared configuration is ai/trading_knowledge/config/indicators.json. Null warm-up/undefined values are retained; no trading signals or classification thresholds. Series are indexed to the input close timestamps. Ichimoku projected spans are raw values for future placement, aligned spans are causal. Wilder ATR begins after n prior-close true ranges; ADX after n DX values; zero denominators are null. Gaps are disclosed, not filled.

## Existing implementation audit
- Dashboard Ichimoku uses 18/52/104 with displacement 52. Analysis config intentionally uses 9/26/52/26. No dashboard settings changed. Generalizing shared midpoint code is a follow-up to preserve tested chart parity.
- Corrected lib/ticks/candles.ts to map '3m' to 180 seconds; analysis shares that constant. Historical/recent APIs read preaggregated Supabase candles, so the upstream writer must still be verified against actual 180-second buckets. Do not relabel legacy 5-minute data. Gaps can represent closures or incomplete feed; do not claim confidence from cadence alone.
- Existing Force Score is causal with 100-bar baseline; extraction to a neutral module and parity tests remain follow-up. Existing volume profile uses tick-count RPC, so requires separate snapshot tick evidence; do not fake it from OHLC. Existing key levels use forward confirmation windows; causal swing/range adapters remain follow-up.
- No SDK, UI components or database changes; shared timeframe fallback corrected. No classifier policy, range boundaries, or calibrated risk thresholds introduced.

## Test command
`node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./lib/ticks/register-ts.mjs --test lib/market-analysis/indicators.test.ts`

Next: shared force adapter, causal structure features, deterministic tool contracts and fixtures; then workspace. Validate feed cadence first.
