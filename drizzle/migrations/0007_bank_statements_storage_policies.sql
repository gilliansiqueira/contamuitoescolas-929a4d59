CREATE POLICY "Admins read bank statements" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bank-statements' AND public.is_admin());
CREATE POLICY "Admins upload bank statements" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-statements' AND public.is_admin());
CREATE POLICY "Admins delete bank statements" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bank-statements' AND public.is_admin());