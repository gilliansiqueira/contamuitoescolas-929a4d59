DROP POLICY IF EXISTS "KPI icons are publicly accessible" ON storage.objects;
CREATE POLICY "KPI icons readable by signed-in users" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kpi-icons');
DROP POLICY IF EXISTS "Card brand icons publicly accessible" ON storage.objects;
CREATE POLICY "Card brand icons readable by signed-in users" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'card-brand-icons');