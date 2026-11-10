-- PROMOÇÃO FUTURA (não aplicado). Aditivo: coluna nova + função. Nada é apagado.
ALTER TABLE public.team_time_sync_runs ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS team_time_sync_runs_idem_success
  ON public.team_time_sync_runs (idempotency_key) WHERE status = 'success' AND idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.team_time_import_report(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text := p->>'idempotency_key';
  v_ini date := (p->>'periodoInicio')::date;
  v_fim date := (p->>'periodoFim')::date;
  v_prev public.team_time_sync_runs;
  v_counts jsonb; v_run uuid; v_now timestamptz := now();
BEGIN
  IF v_key IS NULL OR v_key !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'idempotency_key inválida'; END IF;
  IF v_ini IS NULL OR v_fim IS NULL OR v_ini > v_fim THEN RAISE EXCEPTION 'período inválido'; END IF;
  IF p::text ~* '"(cpf|pis|pispasep|nis)"\s*:' THEN RAISE EXCEPTION 'campo proibido'; END IF;
  -- Importações do ponto são serializadas (concorrência).
  PERFORM pg_advisory_xact_lock(hashtext('team_time_import_report'));
  SELECT * INTO v_prev FROM public.team_time_sync_runs WHERE idempotency_key = v_key AND status = 'success' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','success','replay',true,'run_id',v_prev.id,'counts',v_prev.counts); END IF;

  -- Rechecagem defensiva (a Edge Function já valida).
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'daily') d WHERE (d->>'dia')::date NOT BETWEEN v_ini AND v_fim) THEN RAISE EXCEPTION 'dia fora do período'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'daily') d GROUP BY d->>'employee_external_id', d->>'dia' HAVING count(*) > 1) THEN RAISE EXCEPTION 'dia repetido'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p->'daily') d WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p->'employees') e WHERE e->>'external_id' = d->>'employee_external_id')) THEN RAISE EXCEPTION 'dia sem funcionário'; END IF;

  -- Funcionários: só campos vindos do relatório; user_id, oculto*, desligado_em, horario_override intocados.
  INSERT INTO public.team_time_employees (external_id, matricula, nome, cargo, departamento, ativo, synced_at)
  SELECT e->>'external_id', e->>'matricula', e->>'nome', e->>'cargo', e->>'departamento', true, v_now FROM jsonb_array_elements(p->'employees') e
  ON CONFLICT (external_id) DO UPDATE SET matricula = EXCLUDED.matricula, nome = EXCLUDED.nome, cargo = EXCLUDED.cargo,
    departamento = EXCLUDED.departamento, ativo = true, synced_at = EXCLUDED.synced_at;

  -- Dias: upsert somente nos dias lidos (mantém id); dias ausentes ficam como estão.
  INSERT INTO public.team_time_daily (employee_external_id, dia, horario_previsto, primeira_marcacao, ultima_marcacao, marcacoes, horas_trabalhadas, horas_extras, situacao, ocorrencia, synced_at)
  SELECT d->>'employee_external_id', (d->>'dia')::date, d->>'horario_previsto', d->>'primeira_marcacao', d->>'ultima_marcacao',
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(d->'marcacoes')), '{}'), d->>'horas_trabalhadas', d->>'horas_extras', d->>'situacao', d->>'ocorrencia', v_now
  FROM jsonb_array_elements(p->'daily') d
  ON CONFLICT (employee_external_id, dia) DO UPDATE SET horario_previsto = EXCLUDED.horario_previsto, primeira_marcacao = EXCLUDED.primeira_marcacao,
    ultima_marcacao = EXCLUDED.ultima_marcacao, marcacoes = EXCLUDED.marcacoes, horas_trabalhadas = EXCLUDED.horas_trabalhadas,
    horas_extras = EXCLUDED.horas_extras, situacao = EXCLUDED.situacao, ocorrencia = EXCLUDED.ocorrencia, synced_at = EXCLUDED.synced_at;

  -- Ocorrências do PDF: troca só origem relatorio_pdf nos dias lidos; outras origens intocadas.
  DELETE FROM public.team_time_occurrences o USING jsonb_array_elements(p->'daily') d
   WHERE o.origem = 'relatorio_pdf' AND o.employee_external_id = d->>'employee_external_id' AND o.dia = (d->>'dia')::date
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p->'occurrences') x WHERE x->>'external_key' = o.external_key);
  INSERT INTO public.team_time_occurrences (external_key, employee_external_id, dia, tipo, descricao, origem, synced_at)
  SELECT x->>'external_key', x->>'employee_external_id', (x->>'dia')::date, x->>'tipo', NULL, 'relatorio_pdf', v_now FROM jsonb_array_elements(p->'occurrences') x
  ON CONFLICT (external_key) DO UPDATE SET tipo = EXCLUDED.tipo, synced_at = EXCLUDED.synced_at
    WHERE public.team_time_occurrences.origem = 'relatorio_pdf';

  v_counts := jsonb_build_object('funcionarios', jsonb_array_length(p->'employees'), 'dias', jsonb_array_length(p->'daily'), 'ocorrencias', jsonb_array_length(p->'occurrences'));
  INSERT INTO public.team_time_sync_runs (trigger, status, requested_by, reference_date, finished_at, counts, message, idempotency_key)
  VALUES ('relatorio_pdf', 'success', NULLIF(p->>'requested_by','')::uuid, v_fim, now(), v_counts, left(p->>'arquivo', 200), v_key)
  RETURNING id INTO v_run;
  RETURN jsonb_build_object('status','success','replay',false,'run_id',v_run,'counts',v_counts);
END $$;

REVOKE ALL ON FUNCTION public.team_time_import_report(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.team_time_import_report(jsonb) TO service_role;
