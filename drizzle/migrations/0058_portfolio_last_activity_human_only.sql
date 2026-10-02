CREATE OR REPLACE FUNCTION public.get_management_portfolio(_month text)
 RETURNS TABLE(school_id uuid, school_name text, responsible_user_id uuid, responsible_email text, closing_due_day integer, data_updated_through text, last_activity_at timestamp with time zone, reconciliation_percent numeric, reconciliation_pending bigint, closing_percent numeric, checklist_pending bigint, report_delivered boolean, period_closed boolean, waiting_for_client boolean, review_complete boolean, next_action text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_all boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  IF _month !~ '^[0-9]{4}-[0-9]{2}$' THEN RAISE EXCEPTION 'Período inválido.'; END IF;
  v_all := public.is_super_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.admin_scope = 'all');
  RETURN QUERY SELECT s.id, s.nome, sms.responsible_user_id, rp.email, COALESCE(sms.closing_due_day, 10),
    GREATEST(fe.last_date, re.last_date, bt.last_date),
    la.last_activity,
    CASE WHEN COALESCE(bt.recon_required, 0) = 0 THEN NULL ELSE round((COALESCE(bt.reconciled, 0)::numeric / bt.recon_required::numeric) * 100, 1) END,
    COALESCE(bt.recon_pending, 0),
    CASE WHEN COALESCE(cl.applicable, 0) = 0 THEN NULL ELSE round((COALESCE(cl.completed, 0)::numeric / cl.applicable::numeric) * 100, 1) END,
    COALESCE(cl.pending, 0), (rd.id IS NOT NULL),
    EXISTS (SELECT 1 FROM public.period_closures pc WHERE pc.school_id = s.id AND pc.month = _month AND pc.status = 'closed'),
    COALESCE(mc.waiting_for_client, false), COALESCE(mc.review_complete, false), mc.next_action
  FROM public.schools s
  LEFT JOIN public.school_management_settings sms ON sms.school_id = s.id
  LEFT JOIN public.profiles rp ON rp.user_id = sms.responsible_user_id
  LEFT JOIN public.monthly_closing_cycles mc ON mc.school_id = s.id AND mc.month = _month
  LEFT JOIN public.report_deliveries rd ON rd.school_id = s.id AND rd.month = _month
  LEFT JOIN LATERAL (SELECT max(f.data) AS last_date FROM public.financial_entries f WHERE f.school_id = s.id AND left(f.data, 7) <= _month) fe ON true
  LEFT JOIN LATERAL (SELECT max(r.data) AS last_date FROM public.realized_entries r WHERE r.school_id = s.id AND left(r.data, 7) <= _month) re ON true
  LEFT JOIN LATERAL (SELECT max(b.data) AS last_date, count(*) FILTER (WHERE b.recon_status <> 'nao_aplica') AS recon_required,
    count(*) FILTER (WHERE b.recon_status = 'conciliado') AS reconciled, count(*) FILTER (WHERE b.recon_status = 'pendente') AS recon_pending
    FROM public.bank_transactions b WHERE b.school_id = s.id AND left(b.data, 7) = _month) bt ON true
  LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE c.status <> 'not_applicable') AS applicable,
    count(*) FILTER (WHERE c.status = 'completed') AS completed, count(*) FILTER (WHERE c.status = 'open') AS pending
    FROM public.monthly_closing_checklist c WHERE c.school_id = s.id AND c.month = _month) cl ON true
  LEFT JOIN LATERAL (
    SELECT max(t.ts) AS last_activity FROM (
      SELECT max(f.created_at) AS ts FROM public.financial_entries f WHERE f.school_id = s.id
      UNION ALL SELECT max(f.imported_at) FROM public.financial_entries f WHERE f.school_id = s.id
      UNION ALL SELECT max(r.created_at) FROM public.realized_entries r WHERE r.school_id = s.id
      UNION ALL SELECT max(b.created_at) FROM public.bank_transactions b WHERE b.school_id = s.id
      UNION ALL SELECT max(i.created_at) FROM public.bank_statement_imports i WHERE i.school_id = s.id
      UNION ALL SELECT max(h.changed_at) FROM public.bank_reconciliation_history h WHERE h.school_id = s.id
      UNION ALL SELECT max(a.created_at) FROM public.audit_log a WHERE a.school_id = s.id
      UNION ALL SELECT max(c.completed_at) FROM public.monthly_closing_checklist c WHERE c.school_id = s.id AND c.completed_by IS NOT NULL AND c.status = 'completed'
    ) t
  ) la ON true
  WHERE COALESCE(sms.is_active, true) AND NOT public.is_demo_school(s.id) AND (v_all OR sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), s.id))
  ORDER BY s.nome;
END; $function$;