import type { Regime } from './regime'

export type GuideVariant = {
  title: string
  body: string[]
  bullets?: string[]
}

export type GuideSection = {
  title: string
  bullets?: string[]
  variants?: GuideVariant[]
}

export type GuideArticle = {
  regime: Regime
  title: string
  sections: GuideSection[]
}

const CHOPPY: GuideArticle = {
  regime: 'choppy',
  title: 'Trading the Choppy Market',
  sections: [
    {
      title: 'When',
      bullets: [
        'Primary TF: current',
        'Regime: choppy',
        'HTF context: Up or down trend',
      ],
    },
    {
      title: 'Thesis',
      bullets: [
        'Trade within the established channel. Often appear after a strong move. Can act as consolidation for trend continuation.',
        'Choppy ranges are often relatively narrow, so RR deteriorates quickly on a late entry.',
        'Nested choppy ranges are common, so this regime usually offers more trading opportunities than a trending market.',
      ],
    },
    {
      title: 'Default playbook',
      bullets: [
        'Entry: near one channel boundary',
        'SL: just beyond the range boundary',
        'TP: opposite side of the channel',
        'Buffer: keep a sufficient buffer; Reverse Marubozu patterns can invalidate quickly',
      ],
    },
    {
      title: 'Wait / no-trade',
      bullets: ['Do not chase price', 'Do not enter late; RR deteriorates very quickly'],
    },
    {
      title: 'Recognition',
      bullets: [
        'Levels: strong key levels; HTF resistance or support can cap a fall-through',
        'Candles: tightening price, truncated Marubozu, Doji, Reverse Marubozu',
        'Other: reversal clues should appear at strong key levels',
      ],
    },
    {
      title: 'Variants',
      variants: [
        {
          title: 'Extend TP on anticipated breakout',
          body: [
            'If the breakout direction after consolidation can be anticipated, TP may extend beyond the choppy range.',
          ],
        },
        {
          title: 'Nested choppy',
          body: ['Choppy inside choppy. Treat each inner range as its own channel trade.'],
        },
      ],
    },
    {
      title: 'Traps',
      bullets: [
        'Reverse Marubozu can invalidate very quickly in chop',
        'Fall-through: a deceptively slow sequence of small candles where opposing reversal candles keep appearing but get truncated before they develop. Directional pressure is still dominant and absorbing every reversal attempt. Can persist until a strong HTF resistance or support.',
        'Flush: a tighten of the in-range trend that is not enough to shake out all weak traders, then a flush below. These flushes typically appear inside a fall-through.',
        'Over trade: nested chop offers more trades than a trend, which makes it easy to over trade and lose discipline',
      ],
    },
  ],
}

const UPTREND: GuideArticle = {
  regime: 'uptrend',
  title: 'Trading the Uptrend',
  sections: [
    {
      title: 'When',
      bullets: [
        'Primary TF: current',
        'Regime: uptrend',
        'HTF context: A bigger up trend (this is a sub wave), A choppy market (this is an in-range move) or A down trend (this is a correction up trend)',
      ],
    },
    {
      title: 'Thesis',
      bullets: [
        'There is generally no trade until price enters a correction. That correction can last a long time, so the trade itself follows the choppy-market playbook.',
      ],
    },
    {
      title: 'Default playbook',
      bullets: [
        'Entry: after a correction, as the uptrend resumes',
        'SL: trail along the position; more room than in a downtrend because corrections are deeper',
        'TP: target the closest non-tested key resistance level, extend to high time frame resistance level',
        'Order: buy; hold as long as the uptrend holds',
        'Buffer: easier to size correctly than in a downtrend because the move is slower',
      ],
    },
    {
      title: 'Wait / no-trade',
      bullets: [
        'No trade opportunity until a correction begins',
        'Reverse-order (countertrend) is more acceptable than the reverse-order of a downtrend. Reverse-order if HTF context is downtrend or choppy market is acceptable, but not if HTF context is uptrend',
      ],
    },
    {
      title: 'Recognition',
      bullets: [
        'Levels: previous HTF support, tested multiple times by the sell side. More tests → stronger uptrend after.',
        'Candles: truncated (not growing) bear Marubozu at that support, doji',
      ],
    },
    {
      title: 'Variants',
      variants: [
        {
          title: 'Long correction',
          body: [
            'A correction lasts longer when it is strong enough that bullish trend participants reconsider and become more conservative. Bulls then need time to rebuild momentum. Price may repeatedly test key levels inside the corrective range before the uptrend resumes.',
            'A strong correction with growing Marubozu candles during 2 of 3 phases of the corrective wave often leads to an extended choppy market.',
          ],
        },
        {
          title: 'Short correction',
          body: [
            'A correction tends to be shorter when selling pressure is weak relative to the prevailing bullish momentum:',
          ],
          bullets: [
            'Weak selling: the sell side fails to produce strong Marubozu candles during 2 of 3 phases of the corrective wave.',
            'Overwhelming buying: strong bullish Engulfing patterns appear near the bottom of the correction; buyers are absorbing selling pressure and may resume the uptrend.',
          ],
        },
      ],
    },
    {
      title: 'Traps',
      bullets: [
        'Reverse-order entries: more acceptable than in a downtrend, but still not the default if HTF is uptrend',
        'Deep / long corrections can look like a regime change; follow the choppy playbook until the uptrend resumes',
      ],
    },
    {
      title: 'Related',
      bullets: ['Trading the Choppy Market'],
    },
  ],
}

const DOWNTREND: GuideArticle = {
  regime: 'downtrend',
  title: 'Trading the Downtrend',
  sections: [
    {
      title: 'When',
      bullets: [
        'Primary TF: current',
        'Regime: downtrend',
        'HTF context: A bigger down trend (this is a sub wave), A choppy market (this is an in-range move) or An up trend (this is a correction down trend)',
      ],
    },
    {
      title: 'Thesis',
      bullets: [
        'A strong downtrend moves faster than an uptrend. Corrections are often shallower, so the SL is often not safe. The workable approach is to enter as the downtrend is forming, hold the sell, and trail the SL.',
      ],
    },
    {
      title: 'Default playbook',
      bullets: [
        'Entry: when the downtrend is forming (often at tested HTF resistance)',
        'SL: trail along the position',
        'TP: target the closest non-tested key support level, extend to high time frame support level',
        'Order: sell; hold as long as possible',
        'Buffer: harder to size correctly than in an uptrend because the move is faster',
      ],
    },
    {
      title: 'Wait / no-trade',
      bullets: [
        'Do not treat a reverse-order (countertrend) as the default. It is riskier than the reverse-order of an uptrend. Reverse-order if HTF context is uptrend or choppy market is acceptable, but not if HTF context is downtrend',
      ],
    },
    {
      title: 'Recognition',
      bullets: [
        'Levels: previous HTF resistance, tested multiple times by the bull side. More tests → stronger downtrend after.',
        'Candles: truncated (not growing) bull Marubozu at that resistance, doji',
      ],
    },
    {
      title: 'Variants',
      variants: [
        {
          title: 'Long correction',
          body: [
            'A correction lasts longer when it is strong enough that bearish trend participants reconsider and become more conservative. Bears then need time to rebuild momentum. Price may repeatedly test key levels inside the corrective range before the downtrend resumes.',
            'A strong correction with growing Marubozu candles during 2 of 3 phases of the corrective wave often leads to an extended choppy market.',
          ],
        },
        {
          title: 'Short correction',
          body: [
            'A correction tends to be shorter when buying pressure is weak relative to the prevailing bearish momentum:',
          ],
          bullets: [
            'Weak buying: the buy side fails to produce strong Marubozu candles during 2 of 3 phases of the corrective wave.',
            'Overwhelming selling: strong bearish Engulfing patterns appear near the top of the correction; sellers are absorbing buying pressure and may resume the downtrend.',
          ],
        },
      ],
    },
    {
      title: 'Traps',
      bullets: [
        'Reverse-order entries: faster move makes a safe buffer hard to calculate, or SL easily get eaten up',
        'Shallow corrections leave the SL exposed',
      ],
    },
    {
      title: 'Related',
      bullets: ['Trading the Choppy Market'],
    },
  ],
}

const ARTICLES: Record<Regime, GuideArticle> = {
  choppy: CHOPPY,
  uptrend: UPTREND,
  downtrend: DOWNTREND,
}

export function articleForRegime(primary: Regime): GuideArticle {
  return ARTICLES[primary]
}
