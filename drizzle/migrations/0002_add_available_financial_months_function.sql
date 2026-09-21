CREATE OR REPLACE FUNCTION public.get_available_financial_months(_school_id uuid)
RETURNS TABLE(month text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT source.month
  FROM (
    SELECT LEFT(fe.data, 7) AS month
    FROM public.financial_entries AS fe
    WHERE fe.school_id = _school_id
      AND fe.data IS NOT NULL
      AND LENGTH(fe.data) >= 7
    UNION
    SELECT hm.month
    FROM public.historical_monthly AS hm
    WHERE hm.school_id = _school_id
      AND hm.month IS NOT NULL
    UNION
    SELECT pcs.month
    FROM public.period_closure_snapshots AS pcs
    WHERE pcs.school_id = _school_id
      AND pcs.month IS NOT NULL
  ) AS source
  WHERE source.month ~ '^[0-9]{4}-[0-9]{2}$'
  ORDER BY source.month;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_financial_months(uuid) TO anon, authenticated, service_role;