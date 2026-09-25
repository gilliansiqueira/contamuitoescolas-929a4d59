CREATE OR REPLACE FUNCTION public.refresh_bank_cashflow_status(_school_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.school_data_sources d SET
    last_synced_at = now(),
    last_error = NULL,
    synced_through = (
      SELECT min(mx) FROM (
        SELECT greatest(
          (SELECT max(b.data) FROM public.bank_transactions b WHERE b.account_id = a.id AND NOT b.is_forecast),
          (SELECT max(i.periodo_fim) FROM public.bank_statement_imports i WHERE i.account_id = a.id)
        ) AS mx
        FROM public.bank_accounts a WHERE a.school_id = _school_id AND a.ativa
      ) z
    )
  WHERE d.school_id = _school_id;
END; $function$;