# Analytical tool registry v0.1

Tools are read-only observations, not trade signals. Each result follows the shared contract, carries evidence references (bar interval, indicator/config version, formula) and uses explicit missing-data status. P0 tools mandatory per applicable regime; P1 deferred until calibrated.

| Tool | Regime | Priority | Features / computation |
|---|---|---|---|
| classify_market_regime | all | P0 | ADX, DI spread, ER, regression slope/ATR, R², structural progression; versioned classifier policy |
| analyze_volatility | all | P0 | ATR, trailing percentile, short/long ATR ratio |
| analyze_momentum | all | P0 | bullish/bearish force sums, pressure, lagged change |
| analyze_timeframe_alignment | all | P0 | independent M3/M15 classifications and signed pressure, disagreement; never imply reversal |
| analyze_trend_strength | trends, transition | P0 | ADX, lagged ADX change, ER, R² |
| analyze_trend_extension | trends, transition | P0 | signed price-Kijun/ATR, nearest aligned cloud edge distance/ATR, historical percentile |
| analyze_range_structure | ranging, transition | P0 | confirmed swing bounds, width points/ATR, boundary test count; unknown if no established range |
| analyze_range_position | ranging, transition | P0 | (close-lower)/(upper-lower), %B, distance to each boundary |
| analyze_range_stability | ranging | P1 | bandwidth percentile, middle-band slope/ATR, boundary drift |
| analyze_range_asymmetry | ranging | P1 | rejection magnitude ratio, failed traversals |
| analyze_nested_range | ranging | P1 | confirmed inner/outer width ratio |
| analyze_range_breakout | ranging, transition | P1 | consecutive outside closes, displacement/ATR, bandwidth change |
| analyze_trend_structure | trends | P1 | swing progression, root distance, breaks |
| analyze_correction | trends | P1 | retracement/preceding impulse, duration, countertrend ER |
| analyze_trend_exhaustion | trends | P1 | force/ADX changes, opposing pressure |
| analyze_directional_persistence | trends | P1 | same-direction close ratio, pullback depth, failed opposing reactions |
| analyze_compression | transition | P1 | ATR and bandwidth contraction |
| analyze_expansion | transition | P1 | ATR and bandwidth growth, ER change |
| analyze_breakout_quality | transition | P1 | distance from frozen boundary/ATR, persistence, retracement |
| analyze_regime_instability | transition | P1 | classification changes across trailing windows |
| analyze_failed_breakout | transition | P1 | re-entry depth, duration outside, opposing pressure |
| analyze_key_levels | all | P1 | distance, confirmed tests, penetration, rejection |
| analyze_price_acceptance | all | P1 | POC, value area, concentration |
| analyze_price_space | all | P1 | distance to nearest confirmed obstacles on both sides |
| analyze_session_context | all | P1 | configured session offset, remaining allowed time |

Unknown regime: run common tools and available trend/range metrics without claiming applicability. Boundary test tolerance, swing windows, roots, failed reactions, percentile windows and classification thresholds require explicit calibration before production; no invented defaults. Validate deterministic fixtures, flat series, insufficient warm-up, missing/duplicate bars, mirrored series, no-lookahead and cross-timeframe alignment. Validate exact numerical agreement between chart and tool.

SDK tools should group these deterministic outputs into get_market_context, analyze_trend, analyze_range, analyze_momentum, analyze_transition, analyze_key_levels, compare_timeframes and get_trading_knowledge. Expose only available tools; mandatory calculations execute outside the agent.
