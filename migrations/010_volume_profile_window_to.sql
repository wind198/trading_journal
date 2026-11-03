-- Exact rolling window: [p_from_msc, p_to_msc). Drop old 3-arg overload.
DROP FUNCTION IF EXISTS volume_profile_tick_counts(text, bigint, numeric);

CREATE OR REPLACE FUNCTION volume_profile_tick_counts(
  p_symbol text,
  p_from_msc bigint,
  p_to_msc bigint,
  p_bin_size numeric
)
RETURNS TABLE(price numeric, tick_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    round(priced.px / p_bin_size) * p_bin_size AS price,
    count(*)::bigint AS tick_count
  FROM (
    SELECT
      CASE
        WHEN last > 0 THEN last::numeric
        ELSE ((bid + ask) / 2)::numeric
      END AS px
    FROM ticks
    WHERE symbol = p_symbol
      AND time_msc >= p_from_msc
      AND time_msc < p_to_msc
      AND (last > 0 OR (bid > 0 AND ask > 0))
  ) priced
  WHERE priced.px IS NOT NULL
  GROUP BY 1
  ORDER BY 1
$$;

REVOKE ALL ON FUNCTION volume_profile_tick_counts(text, bigint, bigint, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION volume_profile_tick_counts(text, bigint, bigint, numeric) TO service_role;
