WITH src AS (
  SELECT split_part(row_key,'|',1) mat, overrides FROM public.renewal_rows
  WHERE sheet_id='baec5cba-7e57-4668-92e2-5fcd7674075b' AND split_part(row_key,'|',1) IN ('6058','6068','6047')
), mapped AS (
  SELECT s.mat, jsonb_object_agg(m.dst, s.overrides->m.src) o
  FROM src s, (VALUES ('cmvbdm8s01e','cmv9wpfsgj'),('cmvbdm8s01m','cmv9wpfsgr'),('cmvbdm8s01n','cmv9wpfsgs'),('cmvbdm8s01o','cmv9wpfsgt')) m(src,dst)
  WHERE s.overrides ? m.src GROUP BY s.mat
)
UPDATE public.renewal_rows r SET overrides = mapped.o || r.overrides, updated_at = now()
FROM mapped WHERE r.sheet_id='636773d4-667d-4995-901a-c27549e6733c' AND split_part(r.row_key,'|',1)=mapped.mat;

DELETE FROM public.renewal_rows r WHERE r.sheet_id='baec5cba-7e57-4668-92e2-5fcd7674075b'
  AND EXISTS (SELECT 1 FROM public.renewal_issues i WHERE i.sheet_id=r.sheet_id AND i.row_key=r.row_key AND i.kind='fora_da_base');
DELETE FROM public.renewal_issues WHERE sheet_id='baec5cba-7e57-4668-92e2-5fcd7674075b' AND kind='fora_da_base';
UPDATE public.renewal_sheets SET dirty=true WHERE id='baec5cba-7e57-4668-92e2-5fcd7674075b';