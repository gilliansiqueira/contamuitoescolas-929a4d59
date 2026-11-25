DROP FUNCTION IF EXISTS public.get_management_daily_status(date);
CREATE FUNCTION public.get_management_daily_status(_day date)
 RETURNS TABLE(school_id uuid, ref_day date, recon_required bigint, reconciled bigint, recon_pending bigint, statement_received boolean, reconciled_today bigint, imports_today bigint, last_activity timestamp with time zone, statement_today boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_all boolean; v_ref date; v_start timestamptz; v_end timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  v_all := public.can_oversee_team();
  v_ref := _day - CASE extract(isodow FROM _day)::int WHEN 1 THEN 3 WHEN 7 THEN 2 ELSE 1 END;
  v_start := (_day::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  v_end := ((_day + 1)::timestamp) AT TIME ZONE 'America/Sao_Paulo';
  RETURN QUERY SELECT s.id, v_ref,
    COALESCE(bt.req, 0), COALESCE(bt.ok, 0), COALESCE(bt.pend, 0),
    NOT EXISTS (SELECT 1 FROM public.bank_accounts a WHERE a.school_id = s.id AND a.ativa AND NOT COALESCE(a.extrato_esporadico, false))
    OR EXISTS (SELECT 1 FROM public.bank_statement_imports i JOIN public.bank_accounts a ON a.id = i.account_id
      WHERE i.school_id = s.id AND i.periodo_fim >= v_ref::text AND a.ativa AND NOT COALESCE(a.extrato_esporadico, false)),
    (SELECT count(*) FROM public.bank_reconciliation_history h WHERE h.school_id = s.id AND h.new_status = 'conciliado' AND h.changed_at >= v_start AND h.changed_at < v_end),
    (SELECT count(*) FROM public.bank_statement_imports i WHERE i.school_id = s.id AND i.created_at >= v_start AND i.created_at < v_end),
    GREATEST(
      (SELECT max(h.changed_at) FROM public.bank_reconciliation_history h WHERE h.school_id = s.id AND h.changed_at < v_end),
      (SELECT max(i.created_at) FROM public.bank_statement_imports i WHERE i.school_id = s.id AND i.created_at < v_end),
      (SELECT max(a.created_at) FROM public.audit_log a WHERE a.school_id = s.id AND a.created_at < v_end)),
    NOT EXISTS (SELECT 1 FROM public.bank_accounts a WHERE a.school_id = s.id AND a.ativa AND NOT COALESCE(a.extrato_esporadico, false))
    OR EXISTS (SELECT 1 FROM public.bank_statement_imports i JOIN public.bank_accounts a ON a.id = i.account_id
      WHERE i.school_id = s.id AND i.created_at >= v_start AND i.created_at < v_end AND a.ativa AND NOT COALESCE(a.extrato_esporadico, false))
  FROM (SELECT * FROM public.schools WHERE public.can_see_school(id)) s
  LEFT JOIN public.school_management_settings sms ON sms.school_id = s.id
  LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE b.recon_status <> 'nao_aplica') AS req,
      count(*) FILTER (WHERE b.recon_status = 'conciliado') AS ok,
      count(*) FILTER (WHERE b.recon_status = 'pendente') AS pend
    FROM public.bank_transactions b WHERE b.school_id = s.id AND b.data = v_ref::text AND COALESCE(b.is_forecast, false) = false) bt ON true
  WHERE COALESCE(sms.is_active, true) AND NOT public.is_demo_school(s.id) AND (v_all OR sms.responsible_user_id = auth.uid() OR (NOT EXISTS (SELECT 1 FROM public.profiles pz WHERE pz.user_id = auth.uid() AND pz.admin_scope = 'all') AND public.user_has_school_access(auth.uid(), s.id)));
END; $function$;
REVOKE ALL ON FUNCTION public.get_management_daily_status(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_management_daily_status(date) TO authenticated, service_role;