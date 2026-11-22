CREATE TABLE public.mgmt_weekly_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  categoria_nomes text[] NOT NULL DEFAULT '{}',
  categoria_ids bigint[] NOT NULL DEFAULT '{}',
  split_pct numeric NOT NULL DEFAULT 50 CHECK (split_pct BETWEEN 0 AND 100),
  label_a text NOT NULL DEFAULT 'Empresa',
  label_b text NOT NULL DEFAULT 'Conta Muito',
  active boolean NOT NULL DEFAULT true,
  last_week_start date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mgmt_weekly_reminders TO authenticated;
GRANT ALL ON public.mgmt_weekly_reminders TO service_role;
ALTER TABLE public.mgmt_weekly_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gestão usa lembretes" ON public.mgmt_weekly_reminders TO authenticated USING (public.can_use_mgmt_tasks()) WITH CHECK (public.can_use_mgmt_tasks());
CREATE POLICY "Empresa restrita" ON public.mgmt_weekly_reminders AS RESTRICTIVE TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.run_weekly_mgmt_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; ws date; we date; tot numeric; pend int; lst text; a numeric; n int := 0; today date;
BEGIN
  today := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  ws := date_trunc('week', today)::date - 7; we := ws + 6;
  FOR r IN SELECT * FROM mgmt_weekly_reminders WHERE active AND (last_week_start IS NULL OR last_week_start < ws) LOOP
    SELECT coalesce(sum(valor),0), string_agg(to_char(data,'DD/MM') || ' – ' || coalesce(descricao,'') || ' – R$ ' || to_char(valor,'FM999G999G990D00'), E'\n' ORDER BY data)
      INTO tot, lst FROM erp_push_log
      WHERE school_id = r.school_id AND status = 'enviado' AND tipo = 'saida' AND data BETWEEN ws AND we
        AND olist_categoria_id = ANY(r.categoria_ids);
    SELECT count(*) INTO pend FROM bank_transactions t
      WHERE t.school_id = r.school_id AND t.tipo = 'saida' AND t.data BETWEEN ws AND we
        AND (t.recon_status = 'pendente' OR EXISTS (SELECT 1 FROM erp_push_log l WHERE l.bank_transaction_id = t.id AND l.status = 'a_classificar'));
    a := round(tot * r.split_pct / 100, 2);
    INSERT INTO mgmt_tasks (title, description, school_id, assignee_id, created_by, due_date)
    VALUES (r.title || ' (semana ' || to_char(ws,'DD/MM') || ' a ' || to_char(we,'DD/MM') || ')',
      'Total pago na obra (' || array_to_string(r.categoria_nomes, ', ') || '): R$ ' || to_char(tot,'FM999G999G990D00') || E'\n'
      || r.label_a || ' (' || r.split_pct || '%): R$ ' || to_char(a,'FM999G999G990D00') || E'\n'
      || r.label_b || ' (' || (100 - r.split_pct) || '%): R$ ' || to_char(tot - a,'FM999G999G990D00') || E'\n\n'
      || 'Antes de mandar, confira as pendências e conciliações — algum gasto da obra pode estar em outra categoria ou sem categoria. Saídas da semana pendentes ou "A classificar": ' || pend || E'\n\n'
      || coalesce(lst, 'Nenhum pagamento nas categorias da obra.'),
      r.school_id, r.assignee_id, r.created_by, today);
    UPDATE mgmt_weekly_reminders SET last_week_start = ws, updated_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.run_weekly_mgmt_reminders() FROM PUBLIC, anon, authenticated;