# Trading Decision Flow

Complete decision sequence from context → regime → setup → execute or wait.

Related:

- [Trading the Uptrend](trade_up_trend.md)
- [Trading the Downtrend](trade_down_trend.md)
- [Trading the Choppy Market](trade_choppy_range.md)

```mermaid
flowchart TD
  startNode[Start] --> ctx[Gather context]
  ctx --> ctxCheck{"HTF + primary TF + key levels ready?"}
  ctxCheck -->|No| waitNoTrade["WAIT / NO TRADE"]
  ctxCheck -->|Yes| session{"Major session open with high momentum?"}
  session -->|"Yes and countertrend intent"| waitNoTrade
  session -->|"No or trend-follow OK"| regime{"Classify regime"}

  regime -->|Uptrend| upCorrect
  regime -->|Downtrend| downType
  regime -->|Choppy| chopNested

  subgraph upPath [Uptrend]
    upCorrect{"Correction underway?"}
    upCorrect -->|No| upExtend{"Extended at HTF resistance?"}
    upExtend -->|No| upWait["WAIT / NO TRADE"]
    upExtend -->|Yes| upCtrGate{"Truncated marubozu / doji present?"}
    upCtrGate -->|No| upWait
    upCtrGate -->|Yes| upCtrExec[Countertrend SHORT]
    upCtrExec --> upCtrParams["Limit + buffer<br/>SL above HTF resistance<br/>TP first strong support - no extend"]

    upCorrect -->|Yes| upRoot{"Root intact - correction not fall-through?"}
    upRoot -->|No| upWait
    upRoot -->|Yes| upLevels{"Key + reversal levels tested bullish?"}
    upLevels -->|No| upWait
    upLevels -->|Yes| upReact{"Bull reaction strong / growing - not truncated?"}
    upReact -->|No| upWait
    upReact -->|Yes| upTfExec[Trend-follow LONG]
    upTfExec --> upTfParams["Market or close limit<br/>SL at uptrend root - do not trail early<br/>TP prior high then HTF resistance<br/>Smaller buffer"]
  end

  subgraph downPath [Downtrend]
    downType{"Which downtrend phase?"}

    downType -->|Creating| dnCreate{"Distribution at tested HTF resistance?"}
    dnCreate -->|"No - sudden drop only"| dnWait["WAIT / NO TRADE"]
    dnCreate -->|Yes| dnDistCandles{"Truncated bull marubozu / doji?"}
    dnDistCandles -->|No| dnWait
    dnDistCandles -->|Yes| dnCreateExec[Trend-create SHORT]
    dnCreateExec --> dnCreateParams["Sell + larger buffer<br/>SL above tested HTF resistance - then trail<br/>TP nearest lower support then HTF support<br/>Hold as long as possible"]

    downType -->|Fall-through| dnFt{"Strong breakout confirmation?"}
    dnFt -->|No| dnWait
    dnFt -->|Yes| dnFtExec[Fall-through follow SHORT]
    dnFtExec --> dnFtParams["Enter only after strong breakout<br/>Do not chase shallow corrections<br/>Expect stalled reverse candles"]

    downType -->|"Deep / long correction"| dnCorr{"ABC end + flush? Truncated bear marubozu / doji?"}
    dnCorr -->|No| dnWait
    dnCorr -->|Yes| dnCorrLevels{"Key + reversal levels tested bearish / close below?"}
    dnCorrLevels -->|No| dnWait
    dnCorrLevels -->|Yes| dnCorrReact{"Bear reaction strong / growing?"}
    dnCorrReact -->|No| dnWait
    dnCorrReact -->|Yes| dnTfExec[Trend-follow SHORT]
    dnTfExec --> dnTfParams["Market or close limit<br/>SL at downtrend root - then trail<br/>TP prior low then HTF support<br/>Smaller buffer"]
  end

  subgraph chopPath [Choppy]
    chopNested{"Nested inner range?"}
    chopNested -->|Yes| chopChan
    chopNested -->|No| chopChan
    chopChan{"Established channel?"}
    chopChan -->|No| chopWait["WAIT / NO TRADE"]
    chopChan -->|Yes| chopLate{"Entry near boundary - RR still OK?"}
    chopLate -->|"No - late / chase"| chopWait
    chopLate -->|Yes| chopRev{"Reversal clues at strong key level?"}
    chopRev -->|No| chopWait
    chopRev -->|Yes| chopExec[Channel trade]
    chopExec --> chopParams["Entry near boundary<br/>SL just beyond boundary<br/>TP opposite side<br/>Enough buffer vs reverse marubozu"]
    chopParams --> chopVariant{"Breakout direction anticipated?"}
    chopVariant -->|Yes| chopExtend[Optional: extend TP beyond range]
    chopVariant -->|No| chopDone[Execute channel TP]
  end

  upWait --> waitNoTrade
  dnWait --> waitNoTrade
  chopWait --> waitNoTrade

  upCtrParams --> execute[EXECUTE]
  upTfParams --> execute
  dnCreateParams --> execute
  dnFtParams --> execute
  dnTfParams --> execute
  chopExtend --> execute
  chopDone --> execute

  execute --> manage["Manage: hold / trail only where playbook allows"]
```

## Path summary

| Regime | Allowed setups | Hard waits |
|--------|----------------|------------|
| Uptrend | Trend-follow long after tested correction; countertrend short only on extension + truncation at HTF resistance | No correction; untested levels; weak bull reaction; root fall-through; countertrend before truncation / at major open |
| Downtrend | Create at distribution; follow deep correction; fall-through only after strong breakout | Sudden drop without distribution; chase short correction; untested correction levels; fall-through without breakout |
| Choppy | Boundary-to-boundary; nested ranges; optional extended TP if breakout clear | Chase / late entry; no channel; weak reversal clues |

## Notes from Nov 7

- Prior uptrend key levels must be tested to separate correction vs real downtrend.
- Stronger downtrend root → higher confidence resistance gets pierced.
- Multi-consolidation + strong growing marubozu trends reverse slowly.
- Fall-through from heavy root: shallow corrections, long SL risk, truncated reverse traps → only follow after strong breakout.
- Bigger moves need bigger timeframe validation.
