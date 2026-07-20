
CREATE TABLE public.dashboard_manual_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month text NOT NULL,
  label text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'operacoes' CHECK (section IN ('operacoes','resultado')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_manual_cards TO authenticated;
GRANT ALL ON public.dashboard_manual_cards TO service_role;

ALTER TABLE public.dashboard_manual_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read cards from accessible schools"
  ON public.dashboard_manual_cards FOR SELECT
  TO authenticated
  USING (public.user_has_school_access(auth.uid(), school_id));

CREATE POLICY "admin insert cards"
  ON public.dashboard_manual_cards FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));

CREATE POLICY "admin update cards"
  ON public.dashboard_manual_cards FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin delete cards"
  ON public.dashboard_manual_cards FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER touch_dashboard_manual_cards_updated_at
  BEFORE UPDATE ON public.dashboard_manual_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_dashboard_manual_cards_school_month
  ON public.dashboard_manual_cards(school_id, month);
