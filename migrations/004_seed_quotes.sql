-- Seed Trading & Technical Analysis Notes into quotes.
-- Targets the earliest auth.users row (personal single-user journal).
-- Safe to re-run: deletes prior seeded headlines for that user first.

WITH u AS (
  SELECT id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
),
seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'Scenarios',
        $d$Call out the possible scenarios on the chart, along with the key levels and channels.$d$
      ),
      (
        'Overconfidence in Key Levels',
        $d$Sometimes, even when a key level looks strong, the force piercing through it can be even stronger. This can result in a very weak reaction at the key level and only a short-lived correction.$d$
      ),
      (
        'Overconfidence in Trend Lines',
        $d$A trend line may hold repeatedly, but not indefinitely. It can eventually fail when the root move becomes weak, gets interrupted, and is ultimately invalidated.$d$
      ),
      (
        'Extreme Trade: Keep the Target Short',
        $d$Even when a correction wave has the potential to retrace deeply, an extreme trade should not rely on that scenario. Keep the TP short, ideally just below the nearest resistance.$d$
      ),
      (
        'Emergence of a New Trend',
        $d$A new trend, including a reversal, can be considered confirmed when:

• Price breaks the previous swing high/low; or
• The rejection force clearly outweighs the existing trend force.$d$
      ),
      (
        'Extreme Trade Should Satisfy Multiple Scenarios',
        $d$An extreme trade should be able to work across multiple scenarios that could occur within a short time period. In exchange for a lower RR, the trade aims for a higher probability of winning.$d$
      ),
      (
        'Trend-Following Trades Ignore One Scenario',
        $d$A trend-following trade essentially assumes that the correction will not continue far enough to reverse the trend. Therefore, it intentionally ignores the reversal scenario and trades in the direction of the existing trend.$d$
      ),
      (
        'Distribution',
        $d$A small range, sideways movement, or distribution phase often occurs during periods of low momentum, such as in the morning or late at night.

A distribution phase can become either:

• An accumulation phase for a reversal; or
• An accumulation phase for trend continuation.

The outcome depends largely on the key-level structure and the relative strength of the forces at both boundaries of the range.$d$
      ),
      (
        'Spread Your Entries Along the Trend',
        $d$During sideways movement or trend-following conditions, price may revisit the same support or resistance multiple times. We can spread our entries across these opportunities to better balance risk and reward.$d$
      ),
      (
        'Do Not Place Too Many Extreme Orders',
        $d$Extreme trades are inherently short-term. Therefore, it generally does not make sense to allocate a large position size to a single extreme setup.$d$
      ),
      (
        'Market Nature',
        $d$Market conditions can vary from day to day:

• Some days are strongly bullish.
• Some days are strongly bearish.
• Some days trend with deep corrections.
• Some days remain mostly sideways.

Always adapt to the market's current nature rather than assuming the same behavior every day.$d$
      ),
      (
        'Do Not Get Swept',
        $d$The SL should not be so wide that it tolerates poor discipline, but it should also not be so tight that normal market fluctuations can easily sweep it.$d$
      ),
      (
        'Spread Your TP Along the Trend',
        $d$During trend-following trades, we can spread our TP levels to better balance risk and reward.$d$
      )
  ) AS t(headline, description)
),
deleted AS (
  DELETE FROM quotes q
  USING u, seed s
  WHERE q.user_id = u.id
    AND q.headline = s.headline
  RETURNING q.id
)
INSERT INTO quotes (user_id, headline, description)
SELECT u.id, s.headline, s.description
FROM u
CROSS JOIN seed s;
