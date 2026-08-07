# Trade entry checklist

Multi-step gate before opening a trade on **EURUSD** (forex). Time window uses **Vietnam (UTC+7)**.

See flow diagram: [trade_enter_form.mmd](./trade_enter_form.mmd)

---

## Step 1 — Session window

If local time is between **14:00 and 21:00 (UTC+7)**:

- Show: `No trade entry during this time`
- Exit

Otherwise → Step 2

---

## Step 2 — Direction

Show two buttons: **Buy** and **Sell**

| Choice | Next |
|--------|------|
| Buy | Step 3a |
| Sell | Step 3b |

---

## Step 3a — Buy order type

Show order types (each: icon + label): **Extreme**, **Trend following**

| Choice | Next |
|--------|------|
| Extreme | Show `Buy order at Extreme is dangerous` → Exit |
| Trend following | Step 4a |

---

## Step 3b — Sell order type

Show order types: **Extreme**, **Trend following**

| Choice | Next |
|--------|------|
| Extreme | Step 4b |
| Trend following | Step 4c |

---

## Step 4a — Trend following Buy

Answer all three (Yes / No):
0. Is higher level time frame showing a strong trend?
1. Did the trend break the closest support / resistance (based on key levels & Elliott wave)?
2. Is price gravitating to a support key level with no stronger marubozu or 3 consecutive marubozu (or does the reaction outweigh corrective sell force)?
3. Are there no strong resistances ahead?

| Result | Outcome |
|--------|---------|
| All Yes | `Buy order at Trend following is safe` → Exit |
| Any No | `Trend following Buy order is dangerous` → Exit |

---

## Step 4b — Extreme Sell

Answer all three (Yes / No):

1. Is price slowing down with gravestone dojis or engulfing candles?
2. Is price slowing down at a strong resistance key level?
3. Is the support marubozu of the existing uptrend far away?

| Result | Outcome |
|--------|---------|
| All Yes | `Sell order at Extreme is safe` → Exit |
| Any No | `Extreme Sell order is dangerous` → Exit |

---

## Step 4c — Trend following Sell

Answer all three (Yes / No):
0. Is higher level time frame showing a strong trend?
1. Did the trend break the closest support / resistance (based on key levels & Elliott wave)?
2. Is price gravitating to a support key level with no stronger marubozu or 3 consecutive marubozu (or does the reaction outweigh corrective buy force)?
3. Are there no strong resistances ahead?

| Result | Outcome |
|--------|---------|
| All Yes | `Sell order at Trend following is safe` → Exit |
| Any No | `Trend following Sell order is dangerous` → Exit |


## Appendix — Order concepts

Applies to **EURUSD**.

### Extreme

Counter-trend (correction) entry into an extended market. Expect a correction wave long enough to trade. Do **not** wait for a full reverse trend — enter early to capture the correction.

Exists for both Buy and Sell. **Buy Extreme is considered too dangerous** and is blocked in this checklist (Step 3a → exit). Only **Sell Extreme** continues to the question gate (Step 4b).

### Trend following

With-trend entry. Expect the trend to continue. Enter at the **end of a correction wave**.