BEGIN;
CREATE FUNCTION public.volume_profile_range_tick_counts(p_symbol text,p_from_msc bigint,p_to_msc bigint,p_low numeric,p_high numeric,p_bins integer)
RETURNS TABLE(price numeric,tick_count bigint)
LANGUAGE sql STABLE SET search_path=public AS $$
 WITH grid AS (SELECT greatest(0.00001::numeric,(p_high-p_low)/nullif(p_bins,0)) AS step WHERE p_bins IN (20,30,40) AND p_low>0 AND p_high>=p_low),
 ticks_in_window AS (
 SELECT CASE WHEN last>0 THEN last::numeric ELSE ((bid+ask)/2)::numeric END AS px FROM ticks
 WHERE symbol=p_symbol AND time_msc>=p_from_msc AND time_msc<p_to_msc AND (last>0 OR (bid>0 AND ask>0))
 ), grouped AS (
 SELECT least(p_bins-1,greatest(0,floor((px-p_low)/step))) AS idx,step,count(*)::bigint AS n FROM ticks_in_window CROSS JOIN grid GROUP BY 1,2
 )
 SELECT p_low+(idx+0.5)*step,n FROM grouped ORDER BY 1
$$;
REVOKE ALL ON FUNCTION public.volume_profile_range_tick_counts(text,bigint,bigint,numeric,numeric,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.volume_profile_range_tick_counts(text,bigint,bigint,numeric,numeric,integer) TO service_role;
COMMIT;
