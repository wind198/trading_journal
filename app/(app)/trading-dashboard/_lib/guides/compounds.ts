import type { Regime } from './regime'

export type GuideCompound = {
  htf: Regime
  ltf: Regime
  title: string
  guides: string[]
}

export const GUIDE_COMPOUNDS: readonly GuideCompound[] = [
  {
    htf: 'choppy',
    ltf: 'trending',
    title: '15m choppy × 3m trending',
    guides: [
      'Chasing the short time frame trend can be dangerous as the entry got too far from the choppy boundary',
      'Try to enter at the boundary of the flat sideway area, in the real trend behide the choppy area',
      'Beware of Root CI that make every react look strong disipate quickly, which can cause stop order to be eaten up',
      'Always use stop order with good buffering, as in choppy market, strong candle can easily disipate'
    ],
  },
  {
    htf: 'trending',
    ltf: 'choppy',
    title: '15m trending × 3m choppy',
    guides: [
      'Trade in the direction of the 15m trend, consider 3m choppy as potential botton',
      'Prefer Market order, stop order or close limit order, follow a strong root candle',
      'Beware of wrong bottom, as the choppy can just be a pause in the correction',
      'Counter trend trade is also acceptable (30 - 50 points), but only when trend extended too far from equilibrium and doji appear at a higher lv timeframe resistence, and using high buffer',
    ],
  },
  {
    htf: 'trending',
    ltf: 'trending',
    title: '15m trending × 3m trending',
    guides: [
      'This indicate a strong market move, but sometime can lead to tendency to chase the market to far and become trapped',
      'Always wait for the correction in 3m timeframe, then wait for a new strong root to follow',
      'Always target the SL well below strong root, 1st eliot wave root prefered',
    ],
  },
]

export function compoundForRegimes(htf: Regime, ltf: Regime): GuideCompound | null {
  return GUIDE_COMPOUNDS.find((row) => row.htf === htf && row.ltf === ltf) ?? null
}
