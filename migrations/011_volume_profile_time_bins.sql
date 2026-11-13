-- Tick counts bucketed by candle interval for bottom VP histogram.
CREATE OR REPLACE FUNCTION volume_profile_time_tick_counts(
  p_symbol text,
  p_from_msc bigint,
  p_to_msc bigint,
  p_interval_sec integer
)
RETURNS TABLE(bucket_time bigint, tick_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (floor((time_msc / 1000.0) / p_interval_sec) * p_interval_sec)::bigint AS bucket_time,
    count(*)::bigint AS tick_count
  FROM ticks
  WHERE symbol = p_symbol
    AND time_msc >= p_from_msc
    AND time_msc < p_to_msc
    AND (last > 0 OR (bid > 0 AND ask > 0))
    AND p_interval_sec > 0
  GROUP BY 1
  ORDER BY 1
$$;

REVOKE ALL ON FUNCTION volume_profile_time_tick_counts(text, bigint, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION volume_profile_time_tick_counts(text, bigint, bigint, integer) TO service_role;
