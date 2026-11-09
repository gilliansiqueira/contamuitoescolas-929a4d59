CREATE TABLE public.acquirer_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  enabled boolean NOT NULL DEFAULT false,
  token_enc bytea,
  has_token boolean NOT NULL DEFAULT false,
  token_kind text,
  account_id text, account_nickname text, account_email text,
  start_date text,
  last_test_at timestamptz, last_sync_at timestamptz, last_ok_at timestamptz, last_error text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider)
);
GRANT SELECT (id, school_id, provider, enabled, has_token, token_kind, account_id, account_nickname, account_email, start_date, last_test_at, last_sync_at, last_ok_at, last_error, created_at, updated_at) ON public.acquirer_connections TO authenticated;
GRANT ALL ON public.acquirer_connections TO service_role;
ALTER TABLE public.acquirer_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY acq_conn_read ON public.acquirer_connections FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY acq_conn_restrict ON public.acquirer_connections AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE TABLE public.acquirer_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.acquirer_connections(id) ON DELETE CASCADE,
  action text NOT NULL,
  date_from text, date_to text,
  status text NOT NULL DEFAULT 'rodando',
  fetched integer NOT NULL DEFAULT 0, inserted integer NOT NULL DEFAULT 0, updated integer NOT NULL DEFAULT 0, unchanged integer NOT NULL DEFAULT 0,
  summary jsonb, error text,
  created_by uuid, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE INDEX acquirer_sync_runs_conn_idx ON public.acquirer_sync_runs(connection_id, started_at DESC);
GRANT SELECT ON public.acquirer_sync_runs TO authenticated;
GRANT ALL ON public.acquirer_sync_runs TO service_role;
ALTER TABLE public.acquirer_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY acq_runs_read ON public.acquirer_sync_runs FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY acq_runs_restrict ON public.acquirer_sync_runs AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE TABLE public.acquirer_raw_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.acquirer_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  last_run_id uuid,
  first_seen_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider, external_id)
);
GRANT SELECT ON public.acquirer_raw_events TO authenticated;
GRANT ALL ON public.acquirer_raw_events TO service_role;
ALTER TABLE public.acquirer_raw_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY acq_raw_read ON public.acquirer_raw_events FOR SELECT TO authenticated USING (public.is_super_admin() AND public.admin_manages_school(school_id));
CREATE POLICY acq_raw_restrict ON public.acquirer_raw_events AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE TABLE public.acquirer_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.acquirer_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,
  order_id text, external_reference text,
  canal text NOT NULL DEFAULT 'desconhecido',
  canal_evidencia text,
  status text, status_detail text,
  payment_type text, payment_method text, installments integer,
  valor_bruto numeric NOT NULL DEFAULT 0,
  taxas numeric NOT NULL DEFAULT 0,
  valor_liquido numeric,
  valor_estornado numeric NOT NULL DEFAULT 0,
  fee_details jsonb,
  descricao text,
  date_created timestamptz, date_approved timestamptz, date_last_updated timestamptz, money_release_date timestamptz,
  money_release_status text,
  currency text,
  last_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider, external_id)
);
CREATE INDEX acquirer_sales_school_date_idx ON public.acquirer_sales(school_id, date_created DESC);
GRANT SELECT ON public.acquirer_sales TO authenticated;
GRANT ALL ON public.acquirer_sales TO service_role;
ALTER TABLE public.acquirer_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY acq_sales_read ON public.acquirer_sales FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY acq_sales_restrict ON public.acquirer_sales AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.acquirer_set_token(_conn uuid, _token text, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE k text;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id = 1;
  UPDATE public.acquirer_connections SET token_enc = pgp_sym_encrypt(_token, k), has_token = true, token_kind = _kind, updated_at = now() WHERE id = _conn;
END $$;
CREATE OR REPLACE FUNCTION public.acquirer_get_token(_conn uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE k text; t text;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id = 1;
  SELECT CASE WHEN c.token_enc IS NULL THEN NULL ELSE pgp_sym_decrypt(c.token_enc, k) END INTO t FROM public.acquirer_connections c WHERE c.id = _conn;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.acquirer_set_token(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquirer_get_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquirer_set_token(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquirer_get_token(uuid) TO service_role;