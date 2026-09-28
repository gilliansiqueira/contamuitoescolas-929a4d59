CREATE TABLE public.recon_justification_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recon_justification_reasons TO authenticated;
GRANT ALL ON public.recon_justification_reasons TO service_role;
ALTER TABLE public.recon_justification_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê motivos" ON public.recon_justification_reasons FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Super admin insere motivos" ON public.recon_justification_reasons FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin altera motivos" ON public.recon_justification_reasons FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin apaga motivos" ON public.recon_justification_reasons FOR DELETE TO authenticated USING (public.is_super_admin());

INSERT INTO public.recon_justification_reasons (nome, sort_order) VALUES
 ('Aguardando cliente',1),('Aguardando comprovante',2),('Aguardando gestora',3),('Aguardando lançamento',4),('Aguardando quitação correta de cartão',5);

ALTER TABLE public.bank_transactions
  ADD COLUMN justification_reason_id uuid REFERENCES public.recon_justification_reasons(id),
  ADD COLUMN justification_note text,
  ADD COLUMN justified_by uuid,
  ADD COLUMN justified_at timestamptz;

CREATE OR REPLACE FUNCTION public.bank_tx_justification_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.justification_note IS NOT NULL THEN NEW.justification_note := left(btrim(NEW.justification_note), 200); IF NEW.justification_note = '' THEN NEW.justification_note := NULL; END IF; END IF;
  IF NEW.justification_reason_id IS DISTINCT FROM OLD.justification_reason_id OR NEW.justification_note IS DISTINCT FROM OLD.justification_note THEN
    IF NEW.justification_reason_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.recon_justification_reasons r WHERE r.id = NEW.justification_reason_id AND r.ativo) THEN
      RAISE EXCEPTION 'Motivo de justificativa inválido ou inativo.';
    END IF;
    NEW.justified_by := CASE WHEN NEW.justification_reason_id IS NULL THEN NULL ELSE auth.uid() END;
    NEW.justified_at := CASE WHEN NEW.justification_reason_id IS NULL THEN NULL ELSE now() END;
    INSERT INTO public.bank_reconciliation_history (school_id, transaction_id, old_status, new_status, note, changed_by, changed_by_email)
    VALUES (NEW.school_id, NEW.id, NEW.recon_status, NEW.recon_status,
      'Justificativa: ' || COALESCE((SELECT nome FROM public.recon_justification_reasons WHERE id = NEW.justification_reason_id), 'removida') || COALESCE(' — ' || NEW.justification_note, ''),
      auth.uid(), (SELECT email FROM public.profiles WHERE user_id = auth.uid()));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bank_tx_justification_stamp BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.bank_tx_justification_stamp();

CREATE TABLE public.bank_recon_day_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  dia date NOT NULL,
  closed_by uuid,
  closed_by_email text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, dia)
);
GRANT SELECT ON public.bank_recon_day_closures TO authenticated;
GRANT ALL ON public.bank_recon_day_closures TO service_role;
ALTER TABLE public.bank_recon_day_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe lê fechamentos do dia" ON public.bank_recon_day_closures FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.close_recon_day(_school_id uuid, _day date)
RETURNS TABLE(ok boolean, transaction_id uuid, account_name text, data text, descricao text, valor numeric, tipo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_admin() OR NOT (public.is_super_admin() OR public.user_has_school_access(auth.uid(), _school_id)
     OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.admin_scope = 'all')) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe autorizada.';
  END IF;
  SELECT count(*) INTO n FROM public.bank_transactions b
   WHERE b.school_id = _school_id AND b.recon_status = 'pendente' AND COALESCE(b.is_forecast,false) = false
     AND b.data >= '2026-10-01' AND b.data <= _day::text AND b.justification_reason_id IS NULL;
  IF n > 0 THEN
    RETURN QUERY SELECT false, b.id, a.nome, b.data, COALESCE(NULLIF(b.descricao_editada,''), b.descricao), b.valor, b.tipo
      FROM public.bank_transactions b LEFT JOIN public.bank_accounts a ON a.id = b.account_id
     WHERE b.school_id = _school_id AND b.recon_status = 'pendente' AND COALESCE(b.is_forecast,false) = false
       AND b.data >= '2026-10-01' AND b.data <= _day::text AND b.justification_reason_id IS NULL
     ORDER BY b.data, b.valor;
    RETURN;
  END IF;
  INSERT INTO public.bank_recon_day_closures (school_id, dia, closed_by, closed_by_email)
  VALUES (_school_id, _day, auth.uid(), (SELECT email FROM public.profiles WHERE user_id = auth.uid()))
  ON CONFLICT (school_id, dia) DO UPDATE SET closed_by = EXCLUDED.closed_by, closed_by_email = EXCLUDED.closed_by_email, closed_at = now();
  RETURN QUERY SELECT true, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::text;
END; $$;
GRANT EXECUTE ON FUNCTION public.close_recon_day(uuid, date) TO authenticated;

DROP FUNCTION public.get_management_reconciliation_backlog(date);
CREATE FUNCTION public.get_management_reconciliation_backlog(_day date)
RETURNS TABLE(transaction_id uuid, school_id uuid, data text, descricao text, valor numeric, tipo text, account_name text, reason_name text, justification_note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    AND COALESCE(sms.is_active, true) AND (v_all OR sms.responsible_user_id = auth.uid() OR public.user_has_school_access(auth.uid(), s.id))
  ORDER BY b.data, b.valor;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_management_reconciliation_backlog(date) TO authenticated;