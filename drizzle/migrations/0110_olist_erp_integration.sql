CREATE TABLE public.erp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'olist',
  enabled boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  client_id_enc bytea, client_secret_enc bytea, refresh_token_enc bytea,
  has_credentials boolean NOT NULL DEFAULT false,
  authorized boolean NOT NULL DEFAULT false,
  oauth_state text, oauth_return_url text,
  pending_categoria_id bigint, pending_categoria_nome text,
  last_push_at timestamptz, last_ok_at timestamptz, last_error text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, school_id, provider, enabled, test_mode, has_credentials, authorized, pending_categoria_id, pending_categoria_nome, last_push_at, last_ok_at, last_error, created_at, updated_at) ON public.erp_connections TO authenticated;
GRANT ALL ON public.erp_connections TO service_role;
ALTER TABLE public.erp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY erp_conn_read ON public.erp_connections FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY erp_conn_restrict ON public.erp_connections AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE TABLE public.erp_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL UNIQUE REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  olist_conta_id bigint NOT NULL, olist_conta_nome text,
  start_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erp_account_links TO authenticated;
GRANT ALL ON public.erp_account_links TO service_role;
ALTER TABLE public.erp_account_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY erp_link_read ON public.erp_account_links FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY erp_link_restrict ON public.erp_account_links AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE TABLE public.erp_category_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  model_item_id uuid NOT NULL REFERENCES public.financial_model_template_items(id) ON DELETE CASCADE,
  olist_categoria_id bigint, olist_categoria_nome text,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, model_item_id)
);
GRANT SELECT ON public.erp_category_map TO authenticated;
GRANT ALL ON public.erp_category_map TO service_role;
ALTER TABLE public.erp_category_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY erp_map_read ON public.erp_category_map FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY erp_map_restrict ON public.erp_category_map AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE TABLE public.erp_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.erp_connections(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL UNIQUE REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  data text, descricao text, valor numeric, tipo text,
  acao text NOT NULL,
  status text NOT NULL,
  categoria_origem text,
  model_item_id uuid,
  olist_categoria_id bigint,
  olist_id bigint,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_push_log_school_idx ON public.erp_push_log(school_id, created_at DESC);
GRANT SELECT ON public.erp_push_log TO authenticated;
GRANT ALL ON public.erp_push_log TO service_role;
ALTER TABLE public.erp_push_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY erp_log_read ON public.erp_push_log FOR SELECT TO authenticated USING (public.is_admin() AND public.admin_manages_school(school_id));
CREATE POLICY erp_log_restrict ON public.erp_push_log AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public.erp_set_secret(_conn uuid, _field text, _value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE k text;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id = 1;
  IF _field = 'client_id' THEN UPDATE public.erp_connections SET client_id_enc = pgp_sym_encrypt(_value, k), updated_at = now() WHERE id = _conn;
  ELSIF _field = 'client_secret' THEN UPDATE public.erp_connections SET client_secret_enc = pgp_sym_encrypt(_value, k), updated_at = now() WHERE id = _conn;
  ELSIF _field = 'refresh_token' THEN UPDATE public.erp_connections SET refresh_token_enc = pgp_sym_encrypt(_value, k), updated_at = now() WHERE id = _conn;
  ELSE RAISE EXCEPTION 'campo inválido'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.erp_get_secrets(_conn uuid)
RETURNS TABLE(client_id text, client_secret text, refresh_token text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE k text;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id = 1;
  RETURN QUERY SELECT
    CASE WHEN c.client_id_enc IS NULL THEN NULL ELSE pgp_sym_decrypt(c.client_id_enc, k) END,
    CASE WHEN c.client_secret_enc IS NULL THEN NULL ELSE pgp_sym_decrypt(c.client_secret_enc, k) END,
    CASE WHEN c.refresh_token_enc IS NULL THEN NULL ELSE pgp_sym_decrypt(c.refresh_token_enc, k) END
  FROM public.erp_connections c WHERE c.id = _conn;
END $$;
REVOKE ALL ON FUNCTION public.erp_set_secret(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.erp_get_secrets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_set_secret(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.erp_get_secrets(uuid) TO service_role;