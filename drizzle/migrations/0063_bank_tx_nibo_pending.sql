CREATE TABLE public.bank_tx_nibo_pending (
  transaction_id uuid PRIMARY KEY REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  marked_by uuid DEFAULT auth.uid(),
  marked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.bank_tx_nibo_pending TO authenticated;
GRANT ALL ON public.bank_tx_nibo_pending TO service_role;
ALTER TABLE public.bank_tx_nibo_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe gerencia marcação Nibo" ON public.bank_tx_nibo_pending FOR ALL TO authenticated
  USING (public.is_platform_member() AND public.user_has_school_access(auth.uid(), school_id))
  WITH CHECK (public.is_platform_member() AND public.user_has_school_access(auth.uid(), school_id));
CREATE INDEX idx_bank_tx_nibo_school ON public.bank_tx_nibo_pending(school_id);