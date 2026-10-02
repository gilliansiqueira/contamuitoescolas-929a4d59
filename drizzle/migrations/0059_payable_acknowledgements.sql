CREATE TABLE public.payable_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_id, due_date)
);

GRANT SELECT, INSERT, DELETE ON public.payable_acknowledgements TO authenticated;
GRANT ALL ON public.payable_acknowledgements TO service_role;

ALTER TABLE public.payable_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe gerencia agendamentos de contas a pagar"
ON public.payable_acknowledgements
FOR ALL
TO authenticated
USING (public.is_platform_member())
WITH CHECK (public.is_platform_member());