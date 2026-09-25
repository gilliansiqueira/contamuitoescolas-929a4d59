CREATE OR REPLACE FUNCTION public.enable_bank_cashflow_for_new_school()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.id = public.demo_school_id() THEN RETURN NEW; END IF;
  INSERT INTO public.school_features(school_id, feature_key, enabled)
  VALUES (NEW.id, 'cashflow_bank_pilot', true)
  ON CONFLICT (school_id, feature_key) DO NOTHING;
  INSERT INTO public.school_data_sources(school_id, status, dashboard_source, daily_flow_source, start_month)
  VALUES (NEW.id, 'em_conferencia', 'planilha', 'planilha', '2026-09')
  ON CONFLICT (school_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enable_bank_cashflow_new_school ON public.schools;
CREATE TRIGGER trg_enable_bank_cashflow_new_school
AFTER INSERT ON public.schools FOR EACH ROW EXECUTE FUNCTION public.enable_bank_cashflow_for_new_school();

INSERT INTO public.school_features(school_id, feature_key, enabled)
SELECT id, 'cashflow_bank_pilot', true FROM public.schools WHERE id = 'cc184cd3-a4e4-4aa6-8708-b65fd4b833ee'
ON CONFLICT (school_id, feature_key) DO NOTHING;
INSERT INTO public.school_data_sources(school_id, status, dashboard_source, daily_flow_source, start_month)
SELECT id, 'em_conferencia', 'planilha', 'planilha', '2026-09' FROM public.schools WHERE id = 'cc184cd3-a4e4-4aa6-8708-b65fd4b833ee'
ON CONFLICT (school_id) DO NOTHING;