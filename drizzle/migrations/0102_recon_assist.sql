ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS recon_source text,
  ADD COLUMN IF NOT EXISTS school_system_status text,
  ADD COLUMN IF NOT EXISTS school_system_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS school_system_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS school_system_source text;
COMMENT ON COLUMN public.bank_transactions.recon_source IS 'manual | sugestao | automatico (conciliação assistida)';
COMMENT ON COLUMN public.bank_transactions.school_system_status IS 'pendente | baixado | nao_se_aplica — baixa no Omni/Sponte';

CREATE TABLE public.receipt_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  forecast_total numeric,
  settlement_total numeric,
  bank_total numeric,
  status text NOT NULL,
  diferenca numeric,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_matches TO authenticated;
GRANT ALL ON public.receipt_matches TO service_role;
ALTER TABLE public.receipt_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages receipt matches" ON public.receipt_matches FOR ALL TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restricted schools" ON public.receipt_matches AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.recon_network_patterns(_school_id uuid)
RETURNS TABLE(descricao text, tipo text, item_name text, n bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  RETURN QUERY
  SELECT min(t.descricao), t.tipo, trim(i.name)::text, count(*)
  FROM public.bank_transactions t
  JOIN public.financial_model_template_items i ON i.id = t.model_item_id
  JOIN public.schools s ON s.id = t.school_id
  WHERE t.recon_status = 'conciliado' AND t.is_forecast = false AND t.school_id <> _school_id
    AND public.can_see_school(t.school_id) AND t.data >= to_char(current_date - 365, 'YYYY-MM-DD')
  GROUP BY regexp_replace(upper(t.descricao), '[^A-Z ]', '', 'g'), t.tipo, trim(i.name)
  HAVING count(*) >= 3;
END $$;
GRANT EXECUTE ON FUNCTION public.recon_network_patterns(uuid) TO authenticated;