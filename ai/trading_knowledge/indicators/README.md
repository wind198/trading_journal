# Indicator catalog v0.1

Initial conventional periods are proposals, not calibrated parameters. Implement one shared calculation per indicator per timeframe. All outputs include units, lookback, as-of, warm-up and status.

| ID | Definition / outputs | Minimum history and caveats |
|---|---|---|
| atr | Wilder RMA of max(H-L, abs(H-prevC), abs(L-prevC)); 14 | 15 bars for initial value; additional warm-up for stable estimates |
| adx-dmi | Wilder-smoothed directional moves and TR; +DI/-DI, DX=100*abs(+DI-minusDI)/(+DI+minusDI), ADX=RMA(DX,14) | At least 28 bars; document seed and zero handling |
| efficiency-ratio | abs(C[t]-C[t-20])/sum(abs(delta C),20) | 21 bars; zero denominator null |
| bollinger | SMA20 ± 2 population SD; %B=(C-L)/(U-L); bandwidth=(U-L)/SMA | 20 bars; %B can exceed [0,1] |
| ichimoku | Tenkan midpoint of 9-bar extrema, Kijun 26, Span A mean of both, Span B midpoint 52; plot spans forward 26 | 52 raw, 78 for aligned cloud; no lookahead |
| regression | OLS slope and R² on closes over 20/50 bars; slope/ATR per bar | window length; constant series R² null |
| force-score | Existing algorithm, version/config recorded; aggregate bullish/bearish force separately | verify existing implementation and warm-up before reuse |
| volume-profile | Existing binning and POC/value-area outputs; document volume proxy and allocation | configured window; tick volume is not exchange volume |
| swing-structure | Confirmed local extrema with configurable left/right windows; sequence of HH/HL/LH/LL | no pivot available before right window closes |

Features: signed displacement=(close-reference)/ATR; slope normalized by ATR; directional pressure=(bullForce-bearForce)/(bullForce+bearForce); trailing percentile=100*(count below + 0.5*count equal)/sample count; change=current minus previous specified lag. All undefined ratios null, never substitute zero. Record sample and reference timestamps.
