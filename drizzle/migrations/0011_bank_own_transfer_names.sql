ALTER TABLE public.bank_transactions DROP CONSTRAINT bank_transactions_movement_kind_chk;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_movement_kind_chk CHECK (movement_kind IN ('normal','auto_aplicacao','auto_resgate','operacao','ignorar','transferencia'));

CREATE TABLE public.bank_own_transfer_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  padrao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, padrao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_own_transfer_names TO authenticated;
GRANT ALL ON public.bank_own_transfer_names TO service_role;
ALTER TABLE public.bank_own_transfer_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own transfer names" ON public.bank_own_transfer_names
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());