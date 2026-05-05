
CREATE TABLE public.category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  source_text text NOT NULL,
  source_normalized text NOT NULL,
  target_categoria text NOT NULL,
  match_field text NOT NULL DEFAULT 'categoria',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, source_normalized, match_field)
);

ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY cr_select ON public.category_rules FOR SELECT USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY cr_insert ON public.category_rules FOR INSERT WITH CHECK (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY cr_update ON public.category_rules FOR UPDATE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));
CREATE POLICY cr_delete ON public.category_rules FOR DELETE USING (is_admin() OR user_has_school_access(auth.uid(), school_id));

CREATE TRIGGER tg_category_rules_updated_at
  BEFORE UPDATE ON public.category_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_category_rules_school_norm ON public.category_rules(school_id, source_normalized);
