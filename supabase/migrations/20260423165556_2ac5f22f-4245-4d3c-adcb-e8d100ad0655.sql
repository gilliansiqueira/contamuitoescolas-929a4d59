-- Allow kpi_icons to be global (school_id NULL = visível para todas as empresas)
ALTER TABLE public.kpi_icons ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE public.kpi_icons ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Update RLS to allow everyone to SELECT global icons; only admin can manage globals
DROP POLICY IF EXISTS ki_select ON public.kpi_icons;
CREATE POLICY ki_select ON public.kpi_icons
FOR SELECT USING (
  is_admin()
  OR is_global = true
  OR school_id = current_user_school_id()
);

DROP POLICY IF EXISTS ki_insert ON public.kpi_icons;
CREATE POLICY ki_insert ON public.kpi_icons
FOR INSERT WITH CHECK (
  (is_global = true AND is_admin())
  OR (is_global = false AND (is_admin() OR school_id = current_user_school_id()))
);

DROP POLICY IF EXISTS ki_update ON public.kpi_icons;
CREATE POLICY ki_update ON public.kpi_icons
FOR UPDATE USING (
  (is_global = true AND is_admin())
  OR (is_global = false AND (is_admin() OR school_id = current_user_school_id()))
);

DROP POLICY IF EXISTS ki_delete ON public.kpi_icons;
CREATE POLICY ki_delete ON public.kpi_icons
FOR DELETE USING (
  (is_global = true AND is_admin())
  OR (is_global = false AND (is_admin() OR school_id = current_user_school_id()))
);