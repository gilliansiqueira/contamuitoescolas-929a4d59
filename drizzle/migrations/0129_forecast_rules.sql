CREATE TABLE public.forecast_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fixo','parcela')),
  descricao text NOT NULL CHECK (length(descricao) BETWEEN 1 AND 200),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  valor numeric NOT NULL CHECK (valor > 0),
  categoria text NOT NULL CHECK (length(categoria) BETWEEN 1 AND 200),
  dia int CHECK (dia BETWEEN 1 AND 31),
  data text CHECK (data ~ '^\d{4}-\d{2}-\d{2}$'),
  start_month text CHECK (start_month ~ '^\d{4}-\d{2}$'),
  end_month text CHECK (end_month ~ '^\d{4}-\d{2}$'),
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'fixo' AND dia IS NOT NULL) OR (kind = 'parcela' AND data IS NOT NULL))
);
CREATE INDEX forecast_rules_school_idx ON public.forecast_rules(school_id);
ALTER TABLE public.forecast_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_rules TO authenticated;
GRANT ALL ON public.forecast_rules TO service_role;
CREATE POLICY "Equipe gerencia previsões automáticas" ON public.forecast_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Empresa restrita só super admin" ON public.forecast_rules AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.regenerate_forecast_entries(_school_id uuid, _months int DEFAULT 6)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _upload uuid; r record; i int; _d date; _first date; _n int := 0;
BEGIN
  IF NOT (public.is_admin() AND public.can_see_school(_school_id)) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  SELECT id INTO _upload FROM public.upload_records WHERE school_id = _school_id AND tipo = 'previsao_automatica' LIMIT 1;
  IF _upload IS NULL THEN
    INSERT INTO public.upload_records(school_id, file_name, tipo, record_count)
    VALUES (_school_id, 'Previsão automática', 'previsao_automatica', 0) RETURNING id INTO _upload;
  END IF;
  DELETE FROM public.financial_entries WHERE school_id = _school_id AND origem = 'recorrente' AND data >= to_char(_today, 'YYYY-MM-DD');
  FOR r IN SELECT * FROM public.forecast_rules WHERE school_id = _school_id AND active LOOP
    FOR i IN 0..(CASE WHEN r.kind = 'fixo' THEN _months - 1 ELSE 0 END) LOOP
      IF r.kind = 'fixo' THEN
        _first := (date_trunc('month', _today) + make_interval(months => i))::date;
        IF r.start_month IS NOT NULL AND to_char(_first, 'YYYY-MM') < r.start_month THEN CONTINUE; END IF;
        IF r.end_month IS NOT NULL AND to_char(_first, 'YYYY-MM') > r.end_month THEN CONTINUE; END IF;
        _d := _first + (least(r.dia, extract(day FROM (_first + interval '1 month - 1 day'))::int) - 1);
      ELSE
        _d := r.data::date;
      END IF;
      IF extract(isodow FROM _d) = 6 THEN _d := _d - 1; ELSIF extract(isodow FROM _d) = 7 THEN _d := _d - 2; END IF;
      IF _d < _today THEN CONTINUE; END IF;
      INSERT INTO public.financial_entries(school_id, data, descricao, valor, tipo, categoria, origem, origem_upload_id, tipo_registro, source_kind, source_file, imported_at, created_by, editado_manualmente)
      VALUES (_school_id, to_char(_d, 'YYYY-MM-DD'), r.descricao, r.valor, r.tipo, r.categoria, 'recorrente', _upload, 'projetado', 'forecast_rule', CASE WHEN r.kind = 'fixo' THEN 'Previsão automática (fixo)' ELSE 'Previsão automática (contrato)' END, now(), auth.uid(), false);
      _n := _n + 1;
    END LOOP;
  END LOOP;
  UPDATE public.upload_records SET record_count = (SELECT count(*) FROM public.financial_entries WHERE origem_upload_id = _upload), uploaded_at = now() WHERE id = _upload;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.regenerate_forecast_entries(uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_forecast_entries(uuid, int) TO authenticated;