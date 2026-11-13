DROP POLICY IF EXISTS "equipe card imports" ON public.card_sheet_imports;
DROP POLICY IF EXISTS "equipe card rows" ON public.card_sheet_rows;
CREATE POLICY "equipe card imports" ON public.card_sheet_imports FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "equipe card rows" ON public.card_sheet_rows FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());