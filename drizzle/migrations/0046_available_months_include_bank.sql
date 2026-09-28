CREATE OR REPLACE FUNCTION public.get_available_financial_months(_school_id uuid)
RETURNS TABLE(month text) LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT DISTINCT source.month FROM (
    SELECT LEFT(fe.data, 7) AS month FROM public.financial_entries fe WHERE fe.school_id = _school_id AND fe.data IS NOT NULL
    UNION SELECT hm.month FROM public.historical_monthly hm WHERE hm.school_id = _school_id AND hm.month IS NOT NULL
    UNION SELECT pcs.month FROM public.period_closure_snapshots pcs WHERE pcs.school_id = _school_id AND pcs.month IS NOT NULL
    UNION SELECT LEFT(bt.data::text, 7) FROM public.bank_transactions bt WHERE bt.school_id = _school_id AND bt.data IS NOT NULL
    UNION SELECT LEFT(re.data::text, 7) FROM public.realized_entries re WHERE re.school_id = _school_id AND re.data IS NOT NULL
  ) AS source
  WHERE source.month ~ '^[0-9]{4}-[0-9]{2}$'
  ORDER BY source.month;
$function$;