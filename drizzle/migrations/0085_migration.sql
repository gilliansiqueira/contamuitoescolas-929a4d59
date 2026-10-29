DO $$
DECLARE m jsonb := '{"DataInicio":["data_inicio","date"],"DataTermino":["data_termino","date"],"FoneResidencial":["fone_residencial","text"],"FoneCelular":["fone_celular","text"]}';
BEGIN
  UPDATE public.renewal_sheets s SET columns = (
    SELECT jsonb_agg(CASE WHEN c->>'kind'='manual' AND m ? (c->>'title')
      THEN (c - 'doubt') || jsonb_build_object('kind','imported','source','turmas_existentes','field',m->(c->>'title')->>0,'type',m->(c->>'title')->>1)
      ELSE c END ORDER BY o)
    FROM jsonb_array_elements(s.columns) WITH ORDINALITY x(c,o)
    WHERE NOT (coalesce((c->>'hidden')::boolean,false) AND c->>'field' IN ('data_inicio','data_termino','fone_residencial','fone_celular'))
  ) WHERE s.id='c0caed21-0c23-4776-ba71-11dfc895312c';
END $$;