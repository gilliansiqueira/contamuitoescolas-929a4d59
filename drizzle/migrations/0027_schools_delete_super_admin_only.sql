DROP POLICY IF EXISTS "Admin manage schools delete" ON public.schools;
CREATE POLICY "Super admin delete schools" ON public.schools FOR DELETE TO authenticated USING (public.is_super_admin());