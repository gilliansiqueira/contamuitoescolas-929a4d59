CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.access_key (id int PRIMARY KEY DEFAULT 1, k text NOT NULL);
INSERT INTO private.access_key(id,k) VALUES (1, encode(extensions.gen_random_bytes(32),'hex')) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.access_key FROM PUBLIC, anon, authenticated;

CREATE TABLE public.client_access_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grupo text NOT NULL DEFAULT 'outros',
  servico text NOT NULL,
  url text, login text,
  secret_enc bytea,
  extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao text,
  ordem int NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id,school_id,grupo,servico,url,login,extras,observacao,ordem,archived_at,created_by,created_at,updated_by,updated_at) ON public.client_access_entries TO authenticated;
GRANT ALL ON public.client_access_entries TO service_role;
ALTER TABLE public.client_access_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le acessos" ON public.client_access_entries FOR SELECT TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita acessos" ON public.client_access_entries AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE TABLE public.client_access_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.client_access_entries(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  acao text NOT NULL,
  servico text, url text, login text, secret_enc bytea, extras jsonb, observacao text, grupo text,
  changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id,entry_id,school_id,acao,servico,url,login,extras,observacao,grupo,changed_by,changed_at) ON public.client_access_history TO authenticated;
GRANT ALL ON public.client_access_history TO service_role;
ALTER TABLE public.client_access_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le historico acessos" ON public.client_access_history FOR SELECT TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita hist acessos" ON public.client_access_history AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE TABLE public.client_access_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.client_access_entries(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  user_id uuid, acao text NOT NULL DEFAULT 'ver',
  viewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_access_views TO authenticated;
GRANT ALL ON public.client_access_views TO service_role;
ALTER TABLE public.client_access_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le views" ON public.client_access_views FOR SELECT TO authenticated
  USING (public.is_admin() AND public.user_has_school_access(auth.uid(), school_id));
CREATE POLICY "restrita views" ON public.client_access_views AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));

CREATE OR REPLACE FUNCTION public._access_can(_school uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin() AND public.user_has_school_access(auth.uid(), _school) AND public.can_see_school(_school) $$;

CREATE OR REPLACE FUNCTION public.save_access_entry(_id uuid, _school_id uuid, _grupo text, _servico text, _url text, _login text, _senha text, _change_senha boolean, _extras jsonb, _observacao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE k text; r public.client_access_entries; nid uuid;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id=1;
  IF _id IS NULL THEN
    IF NOT public._access_can(_school_id) THEN RAISE EXCEPTION 'sem permissão'; END IF;
    IF coalesce(trim(_servico),'')='' THEN RAISE EXCEPTION 'informe o serviço'; END IF;
    INSERT INTO public.client_access_entries(school_id,grupo,servico,url,login,secret_enc,extras,observacao,created_by,updated_by)
    VALUES (_school_id,coalesce(_grupo,'outros'),trim(_servico),_url,_login,
      CASE WHEN coalesce(_senha,'')<>'' THEN pgp_sym_encrypt(_senha,k) END, coalesce(_extras,'[]'::jsonb),_observacao,auth.uid(),auth.uid())
    RETURNING id INTO nid;
    INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,changed_by) VALUES (nid,_school_id,'criado',trim(_servico),auth.uid());
    RETURN nid;
  END IF;
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id;
  IF NOT FOUND OR NOT public._access_can(r.school_id) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,url,login,secret_enc,extras,observacao,grupo,changed_by)
  VALUES (r.id,r.school_id, CASE WHEN _change_senha THEN 'senha alterada' ELSE 'editado' END, r.servico,r.url,r.login,r.secret_enc,r.extras,r.observacao,r.grupo,auth.uid());
  UPDATE public.client_access_entries SET grupo=coalesce(_grupo,grupo), servico=coalesce(nullif(trim(_servico),''),servico), url=_url, login=_login,
    secret_enc = CASE WHEN _change_senha THEN (CASE WHEN coalesce(_senha,'')<>'' THEN pgp_sym_encrypt(_senha,k) END) ELSE secret_enc END,
    extras=coalesce(_extras,'[]'::jsonb), observacao=_observacao, updated_by=auth.uid(), updated_at=now()
  WHERE id=_id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reveal_access_secret(_id uuid, _acao text DEFAULT 'ver')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE r public.client_access_entries; k text;
BEGIN
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id;
  IF NOT FOUND OR NOT public._access_can(r.school_id) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  INSERT INTO public.client_access_views(entry_id,school_id,user_id,acao) VALUES (_id,r.school_id,auth.uid(),CASE WHEN _acao='copiar' THEN 'copiar' ELSE 'ver' END);
  IF r.secret_enc IS NULL THEN RETURN NULL; END IF;
  SELECT a.k INTO k FROM private.access_key a WHERE a.id=1;
  RETURN pgp_sym_decrypt(r.secret_enc,k);
END $$;

CREATE OR REPLACE FUNCTION public.reveal_access_history_secret(_hist_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE h public.client_access_history; k text;
BEGIN
  SELECT * INTO h FROM public.client_access_history WHERE id=_hist_id;
  IF NOT FOUND OR NOT public._access_can(h.school_id) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  INSERT INTO public.client_access_views(entry_id,school_id,user_id,acao) VALUES (h.entry_id,h.school_id,auth.uid(),'ver antiga');
  IF h.secret_enc IS NULL THEN RETURN NULL; END IF;
  SELECT a.k INTO k FROM private.access_key a WHERE a.id=1;
  RETURN pgp_sym_decrypt(h.secret_enc,k);
END $$;

CREATE OR REPLACE FUNCTION public.restore_access_version(_hist_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.client_access_history; r public.client_access_entries;
BEGIN
  SELECT * INTO h FROM public.client_access_history WHERE id=_hist_id;
  IF NOT FOUND OR h.servico IS NULL OR h.acao='criado' THEN RAISE EXCEPTION 'versão inválida'; END IF;
  SELECT * INTO r FROM public.client_access_entries WHERE id=h.entry_id;
  IF NOT public._access_can(r.school_id) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,url,login,secret_enc,extras,observacao,grupo,changed_by)
  VALUES (r.id,r.school_id,'restaurado',r.servico,r.url,r.login,r.secret_enc,r.extras,r.observacao,r.grupo,auth.uid());
  UPDATE public.client_access_entries SET servico=h.servico,url=h.url,login=h.login,secret_enc=h.secret_enc,extras=coalesce(h.extras,'[]'),observacao=h.observacao,grupo=coalesce(h.grupo,grupo),updated_by=auth.uid(),updated_at=now() WHERE id=r.id;
END $$;

CREATE OR REPLACE FUNCTION public.archive_access_entry(_id uuid, _archive boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.client_access_entries;
BEGIN
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id;
  IF NOT FOUND OR NOT public._access_can(r.school_id) THEN RAISE EXCEPTION 'sem permissão'; END IF;
  UPDATE public.client_access_entries SET archived_at=CASE WHEN _archive THEN now() END, updated_by=auth.uid(), updated_at=now() WHERE id=_id;
  INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,changed_by) VALUES (_id,r.school_id,CASE WHEN _archive THEN 'arquivado' ELSE 'restaurado do arquivo' END,r.servico,auth.uid());
END $$;

REVOKE EXECUTE ON FUNCTION public.save_access_entry(uuid,uuid,text,text,text,text,text,boolean,jsonb,text), public.reveal_access_secret(uuid,text), public.reveal_access_history_secret(uuid), public.restore_access_version(uuid), public.archive_access_entry(uuid,boolean), public._access_can(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_access_entry(uuid,uuid,text,text,text,text,text,boolean,jsonb,text), public.reveal_access_secret(uuid,text), public.reveal_access_history_secret(uuid), public.restore_access_version(uuid), public.archive_access_entry(uuid,boolean), public._access_can(uuid) TO authenticated;