# Numerical market model

Human playbooks in guidane/ are preserved as hypotheses and context, not executable instructions. Agent observations are numerical, timestamped and reproducible.

Regime: uptrend | downtrend | ranging | transition | unknown. Phase: formation | expansion | correction | consolidation | exhaustion | unknown. Volatility: compressed | normal | elevated | extreme | unknown. Structure: intact | weakening | invalidated | unknown. Directional pressure is a signed numeric measure, independent of regime. A lower-timeframe trend may be a higher-timeframe correction, not proof of reversal.

Classify independently on M3 and M15 using signed DMI, ADX, efficiency ratio, normalized regression slope and structure; range requires evidence of bounded behavior, not merely low ADX. Transition requires changing dispersion/direction or structural evidence; disagreement alone can remain unknown. Thresholds and hysteresis are uncalibrated: do not label production regimes until a versioned policy is supplied. Emit contributing metrics and unknown when required data is missing.

All tools use closed bars sorted by UTC close time, with no future data. Confirmed pivots carry confirmation time, not just pivot time. Ichimoku plotted cloud must be aligned to observation time; projected cloud separate; never read future bars. Reject invalid OHLC, duplicate timestamps, missing warm-up; disclose gaps. EURUSD point size 0.00001 is an initial assumption to verify against feed metadata; pip 0.0001. Volume provenance must distinguish tick volume from actual volume.

Use one immutable configuration per run. Percentiles use trailing historical samples and state sample length; null for insufficient data or zero denominator. Do not infer emotions or predict market direction.
