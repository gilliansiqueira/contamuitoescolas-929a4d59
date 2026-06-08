DROP POLICY IF EXISTS ki_select ON public.kpi_icons;
CREATE POLICY ki_select ON public.kpi_icons FOR SELECT USING (true);