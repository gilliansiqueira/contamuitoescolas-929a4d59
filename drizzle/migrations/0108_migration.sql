CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.bank_api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL UNIQUE REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'inter',
  enabled boolean NOT NULL DEFAULT false,
  start_date text NOT NULL,
  conta_corrente text,
  client_id_enc bytea, client_secret_enc bytea, cert_enc bytea, key_enc bytea,
  has_credentials boolean NOT NULL DEFAULT false,
  cert_expires_at timestamptz,
  last_sync_at timestamptz, last_ok_at timestamptz, last_error text, last_saldo numeric,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, school_id, bank_account_id, provider, enabled, start_date, conta_corrente, has_credentials, cert_expires_at, last_sync_at, last_ok_at, last_error, last_saldo, created_by, created_at, updated_at)
  ON public.bank_api_connections TO authenticated;
GRANT ALL ON public.bank_api_connections TO service_role;
ALTER TABLE public.bank_api_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe vê conexões bancárias" ON public.bank_api_connections FOR SELECT TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "Empresa restrita só super admin" ON public.bank_api_connections AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id));

CREATE TABLE public.bank_api_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.bank_api_connections(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  acao text NOT NULL,
  origem text NOT NULL DEFAULT 'manual',
  ok boolean NOT NULL DEFAULT false,
  periodo_inicio text, periodo_fim text,
  lidas integer NOT NULL DEFAULT 0, inseridas integer NOT NULL DEFAULT 0, ja_existiam integer NOT NULL DEFAULT 0,
  saldo numeric, import_id uuid, erro text,
  user_id uuid, user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_api_sync_runs_conn_idx ON public.bank_api_sync_runs(connection_id, created_at DESC);
GRANT SELECT ON public.bank_api_sync_runs TO authenticated;
GRANT ALL ON public.bank_api_sync_runs TO service_role;
ALTER TABLE public.bank_api_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe vê histórico de sincronização" ON public.bank_api_sync_runs FOR SELECT TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "Empresa restrita só super admin" ON public.bank_api_sync_runs AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id));

-- Token interno do agendamento (só banco e servidor leem)
CREATE TABLE IF NOT EXISTS private.bank_api_cron (id int PRIMARY KEY DEFAULT 1, token text NOT NULL);
INSERT INTO private.bank_api_cron(id, token) VALUES (1, encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bank_api_check_cron(_token text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM private.bank_api_cron WHERE id = 1 AND token = _token);
$$;

CREATE OR REPLACE FUNCTION public.bank_api_set_credentials(_conn uuid, _client_id text, _client_secret text, _cert text, _key text, _cert_expires timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE k text;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id = 1;
  UPDATE public.bank_api_connections SET
    client_id_enc = pgp_sym_encrypt(_client_id, k), client_secret_enc = pgp_sym_encrypt(_client_secret, k),
    cert_enc = pgp_sym_encrypt(_cert, k), key_enc = pgp_sym_encrypt(_key, k),
    has_credentials = true, cert_expires_at = _cert_expires, last_error = NULL, updated_at = now()
  WHERE id = _conn;
END $$;

CREATE OR REPLACE FUNCTION public.bank_api_get_credentials(_conn uuid)
RETURNS TABLE(client_id text, client_secret text, cert text, key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE k text;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id = 1;
  RETURN QUERY SELECT pgp_sym_decrypt(c.client_id_enc, k), pgp_sym_decrypt(c.client_secret_enc, k), pgp_sym_decrypt(c.cert_enc, k), pgp_sym_decrypt(c.key_enc, k)
  FROM public.bank_api_connections c WHERE c.id = _conn AND c.has_credentials;
END $$;

REVOKE ALL ON FUNCTION public.bank_api_check_cron(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_api_set_credentials(uuid, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bank_api_get_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_api_check_cron(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_api_set_credentials(uuid, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.bank_api_get_credentials(uuid) TO service_role;