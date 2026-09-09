ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS expense_detail_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS expense_detail_label text NOT NULL DEFAULT 'Detalhamento';

CREATE TABLE public.expense_detail_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_detail_groups TO authenticated;
GRANT ALL ON public.expense_detail_groups TO service_role;
ALTER TABLE public.expense_detail_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edg_select" ON public.expense_detail_groups FOR SELECT TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id) OR public.is_demo_school(school_id));
CREATE POLICY "edg_insert" ON public.expense_detail_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "edg_update" ON public.expense_detail_groups FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "edg_delete" ON public.expense_detail_groups FOR DELETE TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));

CREATE TABLE public.expense_detail_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.expense_detail_groups(id) ON DELETE CASCADE,
  descricao text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_detail_items_school_data ON public.expense_detail_items (school_id, data);
CREATE INDEX idx_expense_detail_items_group ON public.expense_detail_items (group_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_detail_items TO authenticated;
GRANT ALL ON public.expense_detail_items TO service_role;
ALTER TABLE public.expense_detail_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edi_select" ON public.expense_detail_items FOR SELECT TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id) OR public.is_demo_school(school_id));
CREATE POLICY "edi_insert" ON public.expense_detail_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "edi_update" ON public.expense_detail_items FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "edi_delete" ON public.expense_detail_items FOR DELETE TO authenticated
  USING (public.is_admin() OR public.user_has_school_access(auth.uid(), school_id));