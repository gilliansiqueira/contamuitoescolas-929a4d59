CREATE OR REPLACE FUNCTION public.get_management_reconciliation_backlog(_day date)
 RETURNS TABLE(transaction_id uuid, school_id uuid, data text, descricao text, valor numeric, tipo text, account_name text, reason_name text, justification_note text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_all boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito à equipe autorizada.'; END IF;
  v_all := public.is_super_admin() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.admin_scope = 'all');
  RETURN QUERY SELECT b.id, b.school_id, b.data, COALESCE(NULLIF(b.descricao_editada, ''), b.descricao), b.valor, b.tipo, a.nome, r.nome, b.justification_note
  FROM public.bank_transactions b
  JOIN public.schools s ON s.id = b.school_id
  LEFT JOIN public.school_management_settings sms ON sms.school_id = s.id
  LEFT JOIN public.bank_accounts a ON a.id = b.account_id
  LEFT JOIN public.recon_justification_reasons r ON r.id = b.justification_reason_id
  WHERE b.recon_status = 'pendente' AND COALESCE(b.is_forecast, false) = false
    AND b.data >= '2026-09-01' AND b.data < _day::text
    AND public.can_see_school(s.id)
    AND COALESCE(sms.is_active, true) AND (v_all OR sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), s.id))
  ORDER BY b.data, b.valor;
END; $function$;