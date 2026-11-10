-- PROPOSTA (só teste local). Aplicada DEPOIS das migrations reais 0096–0098.
-- Poderes separados: usar ⊂ editar ⊂ administrar. Grupo de apoio = user_permissions 'access_use' (só este módulo).
ALTER TABLE public.client_access_entries ADD COLUMN restrito boolean NOT NULL DEFAULT false,
  ADD COLUMN meta jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN secret2_enc bytea, ADD COLUMN secret2_tipo text;
ALTER TABLE public.client_access_history ADD COLUMN restrito boolean NOT NULL DEFAULT false, ADD COLUMN meta jsonb, ADD COLUMN secret2_enc bytea, ADD COLUMN secret2_tipo text;
ALTER TABLE public.client_access_views ADD COLUMN servico text;

-- Metadados estruturados: só chaves conhecidas e formatos curtos. Não é detector de segredo.
CREATE FUNCTION public._acc_meta_ok(m jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(m)='object'
   AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(m) k WHERE k NOT IN ('tipo_login','codigo_operador','celular_token'))
   AND coalesce(m->>'tipo_login','individual') IN ('individual','compartilhado','consulta')
   AND coalesce(m->>'codigo_operador','0') ~ '^[0-9]{1,12}$'
   AND coalesce(m->>'celular_token','+0000000000') ~ '^\+?[0-9]{10,13}$' $$;
ALTER TABLE public.client_access_entries ADD CONSTRAINT meta_ok CHECK (public._acc_meta_ok(meta)),
  ADD CONSTRAINT secret2_tipo_ok CHECK (secret2_tipo IS NULL OR secret2_tipo IN ('senha_app'));

CREATE FUNCTION public._acc_perm(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id=auth.uid() AND permission=p) $$;
CREATE FUNCTION public._acc_admin(_s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND public.can_see_school(_s) AND (public.is_super_admin() OR (public.is_admin() AND public._acc_perm('access_admin'))) $$;
CREATE FUNCTION public._acc_edit(_s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (public._acc_admin(_s) OR (public.is_admin() AND public.can_see_school(_s) AND public.user_has_school_access(auth.uid(), _s))) $$;
CREATE FUNCTION public._acc_use(_s uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (public._acc_edit(_s) OR (public.is_admin() AND public.can_see_school(_s) AND public._acc_perm('access_use'))) $$;
-- Item restrito: tudo (usar, ver histórico, editar, arquivar, restaurar, tirar restrição) exige administrar.
CREATE FUNCTION public._acc_item(_s uuid, _restrito boolean, _need text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN _restrito THEN public._acc_admin(_s) WHEN _need='edit' THEN public._acc_edit(_s) ELSE public._acc_use(_s) END $$;

DROP POLICY "equipe le acessos" ON public.client_access_entries;
CREATE POLICY "equipe le acessos" ON public.client_access_entries FOR SELECT TO authenticated USING (public._acc_item(school_id, restrito, 'use'));
DROP POLICY "equipe le historico acessos" ON public.client_access_history;
CREATE POLICY "equipe le historico acessos" ON public.client_access_history FOR SELECT TO authenticated
  USING (public._acc_item(school_id, restrito OR coalesce((SELECT e.restrito FROM public.client_access_entries e WHERE e.id=entry_id), true), 'use'));
DROP POLICY "equipe le views" ON public.client_access_views;
CREATE POLICY "auditoria acessos" ON public.client_access_views FOR SELECT TO authenticated USING (public._acc_admin(school_id));
REVOKE ALL ON public.client_access_views FROM authenticated, anon; GRANT SELECT ON public.client_access_views TO authenticated;
GRANT SELECT (restrito, meta, secret2_tipo) ON public.client_access_entries TO authenticated;
GRANT SELECT (restrito, meta, secret2_tipo) ON public.client_access_history TO authenticated;
-- extras/observacao deixam de ser expostos (texto livre).
REVOKE SELECT (extras, observacao) ON public.client_access_entries FROM authenticated;
REVOKE SELECT (extras, observacao) ON public.client_access_history FROM authenticated;

DROP FUNCTION public.save_access_entry(uuid,uuid,text,text,text,text,text,boolean,jsonb,text);
DROP FUNCTION public.reveal_access_secret(uuid,text);
DROP FUNCTION public.reveal_access_history_secret(uuid);
DROP FUNCTION public.restore_access_version(uuid);
DROP FUNCTION public.archive_access_entry(uuid,boolean);
DROP FUNCTION public._access_can(uuid);

CREATE FUNCTION public._acc_snapshot(r public.client_access_entries, _acao text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,url,login,secret_enc,grupo,restrito,meta,secret2_enc,secret2_tipo,changed_by)
  VALUES (r.id,r.school_id,_acao,r.servico,r.url,r.login,r.secret_enc,r.grupo,r.restrito,r.meta,r.secret2_enc,r.secret2_tipo,auth.uid()) $$;
REVOKE EXECUTE ON FUNCTION public._acc_snapshot(public.client_access_entries,text) FROM PUBLIC;

CREATE FUNCTION public.save_access_entry(_id uuid, _school_id uuid, _grupo text, _servico text, _url text, _login text,
  _senha text, _change_senha boolean, _meta jsonb, _senha2 text DEFAULT NULL, _senha2_tipo text DEFAULT NULL, _change_senha2 boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE k text; r public.client_access_entries; nid uuid;
BEGIN
  SELECT a.k INTO k FROM private.access_key a WHERE a.id=1;
  IF NOT public._acc_meta_ok(coalesce(_meta,'{}')) THEN RAISE EXCEPTION 'metadado não permitido' USING ERRCODE='22023'; END IF;
  IF _id IS NULL THEN
    IF NOT public._acc_edit(_school_id) THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
    IF coalesce(trim(_servico),'')='' THEN RAISE EXCEPTION 'informe o serviço'; END IF;
    INSERT INTO public.client_access_entries(school_id,grupo,servico,url,login,secret_enc,meta,secret2_enc,secret2_tipo,created_by,updated_by)
    VALUES (_school_id,coalesce(_grupo,'outros'),trim(_servico),_url,_login,
      CASE WHEN coalesce(_senha,'')<>'' THEN pgp_sym_encrypt(_senha,k) END, coalesce(_meta,'{}'),
      CASE WHEN coalesce(_senha2,'')<>'' THEN pgp_sym_encrypt(_senha2,k) END, CASE WHEN coalesce(_senha2,'')<>'' THEN _senha2_tipo END, auth.uid(),auth.uid())
    RETURNING id INTO nid;
    INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,changed_by) VALUES (nid,_school_id,'criado',trim(_servico),auth.uid());
    RETURN nid;
  END IF;
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR NOT public._acc_item(r.school_id, r.restrito, 'edit') THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  PERFORM public._acc_snapshot(r, CASE WHEN _change_senha OR _change_senha2 THEN 'senha alterada' ELSE 'editado' END);
  UPDATE public.client_access_entries SET grupo=coalesce(_grupo,grupo), servico=coalesce(nullif(trim(_servico),''),servico), url=_url, login=_login,
    secret_enc = CASE WHEN _change_senha THEN (CASE WHEN coalesce(_senha,'')<>'' THEN pgp_sym_encrypt(_senha,k) END) ELSE secret_enc END,
    secret2_enc = CASE WHEN _change_senha2 THEN (CASE WHEN coalesce(_senha2,'')<>'' THEN pgp_sym_encrypt(_senha2,k) END) ELSE secret2_enc END,
    secret2_tipo = CASE WHEN _change_senha2 THEN (CASE WHEN coalesce(_senha2,'')<>'' THEN _senha2_tipo END) ELSE secret2_tipo END,
    meta=coalesce(_meta,'{}'), extras='[]', observacao=NULL, updated_by=auth.uid(), updated_at=now()
  WHERE id=_id;  -- restrito NUNCA muda aqui
  RETURN _id;
END $$;

CREATE FUNCTION public.reveal_access_secret(_id uuid, _acao text DEFAULT 'ver', _campo text DEFAULT 'senha')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE r public.client_access_entries; k text; v bytea;
BEGIN
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id;
  IF NOT FOUND OR NOT public._acc_item(r.school_id, r.restrito, 'use') THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  INSERT INTO public.client_access_views(entry_id,school_id,user_id,acao,servico)
  VALUES (_id,r.school_id,auth.uid(),(CASE WHEN _acao='copiar' THEN 'copiar' ELSE 'ver' END)||CASE WHEN _campo='senha2' THEN ' (2ª senha)' ELSE '' END,r.servico);
  v := CASE WHEN _campo='senha2' THEN r.secret2_enc ELSE r.secret_enc END;
  IF v IS NULL THEN RETURN NULL; END IF;
  SELECT a.k INTO k FROM private.access_key a WHERE a.id=1;
  RETURN pgp_sym_decrypt(v,k);
END $$;

CREATE FUNCTION public.reveal_access_history_secret(_hist_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, extensions AS $$
DECLARE h public.client_access_history; cur boolean; k text;
BEGIN
  SELECT * INTO h FROM public.client_access_history WHERE id=_hist_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  SELECT e.restrito INTO cur FROM public.client_access_entries e WHERE e.id=h.entry_id;
  -- versão antiga: protegida se a versão OU o item atual for restrito.
  IF NOT public._acc_item(h.school_id, h.restrito OR coalesce(cur,true), 'edit') THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  INSERT INTO public.client_access_views(entry_id,school_id,user_id,acao,servico) VALUES (h.entry_id,h.school_id,auth.uid(),'ver antiga',h.servico);
  IF h.secret_enc IS NULL THEN RETURN NULL; END IF;
  SELECT a.k INTO k FROM private.access_key a WHERE a.id=1;
  RETURN pgp_sym_decrypt(h.secret_enc,k);
END $$;

CREATE FUNCTION public.restore_access_version(_hist_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.client_access_history; r public.client_access_entries;
BEGIN
  SELECT * INTO h FROM public.client_access_history WHERE id=_hist_id;
  IF NOT FOUND OR h.servico IS NULL OR h.acao='criado' THEN RAISE EXCEPTION 'versão inválida'; END IF;
  SELECT * INTO r FROM public.client_access_entries WHERE id=h.entry_id FOR UPDATE;
  IF NOT public._acc_item(r.school_id, r.restrito OR h.restrito, 'edit') THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  PERFORM public._acc_snapshot(r, 'restaurado');
  UPDATE public.client_access_entries SET servico=h.servico,url=h.url,login=h.login,secret_enc=h.secret_enc,meta=coalesce(h.meta,'{}'),
    secret2_enc=h.secret2_enc,secret2_tipo=h.secret2_tipo,grupo=coalesce(h.grupo,grupo),restrito=(r.restrito OR h.restrito),updated_by=auth.uid(),updated_at=now()
  WHERE id=r.id;  -- restaurar nunca remove restrição; snapshot restrito torna o item restrito
END $$;

CREATE FUNCTION public.archive_access_entry(_id uuid, _archive boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.client_access_entries;
BEGIN
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR NOT public._acc_item(r.school_id, r.restrito, 'edit') THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE public.client_access_entries SET archived_at=CASE WHEN _archive THEN now() END, updated_by=auth.uid(), updated_at=now() WHERE id=_id;
  INSERT INTO public.client_access_history(entry_id,school_id,acao,servico,restrito,changed_by) VALUES (_id,r.school_id,CASE WHEN _archive THEN 'arquivado' ELSE 'restaurado do arquivo' END,r.servico,r.restrito,auth.uid());
END $$;

-- Marcar restrito: quem edita pode. Desmarcar: só administrar.
CREATE FUNCTION public.set_access_restricted(_id uuid, _restrito boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.client_access_entries;
BEGIN
  SELECT * INTO r FROM public.client_access_entries WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR NOT (CASE WHEN _restrito AND NOT r.restrito THEN public._acc_edit(r.school_id) ELSE public._acc_admin(r.school_id) END)
    THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  PERFORM public._acc_snapshot(r, CASE WHEN _restrito THEN 'marcado restrito' ELSE 'restrição removida' END);
  UPDATE public.client_access_entries SET restrito=_restrito, updated_by=auth.uid(), updated_at=now() WHERE id=_id;
END $$;

-- Auditoria legível: quem, empresa, serviço, quando, ação. Só administrar.
CREATE FUNCTION public.get_access_audit(_school uuid) RETURNS TABLE(quem text, empresa text, servico text, quando timestamptz, acao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public._acc_admin(_school) THEN RAISE EXCEPTION 'sem permissão' USING ERRCODE='42501'; END IF;
  -- usos (ver/copiar) + mudanças (histórico), sem senhas nem valores antigos
  RETURN QUERY SELECT coalesce(p.email, x.uid::text), s.nome, x.servico, x.at, x.acao FROM (
      SELECT v.user_id uid, v.school_id sid, v.servico, v.viewed_at at, v.acao FROM public.client_access_views v WHERE v.school_id=_school
      UNION ALL
      SELECT h.changed_by, h.school_id, h.servico, h.changed_at, h.acao FROM public.client_access_history h WHERE h.school_id=_school) x
    JOIN public.schools s ON s.id=x.sid LEFT JOIN public.profiles p ON p.user_id=x.uid ORDER BY x.at DESC;
END $$;

DO $$ DECLARE f text; BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND (p.proname LIKE '_acc_%' OR p.proname IN
    ('save_access_entry','reveal_access_secret','reveal_access_history_secret','restore_access_version','archive_access_entry','set_access_restricted','get_access_audit'))
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
       IF f NOT LIKE '%_acc_snapshot%' AND f NOT LIKE '%_acc_meta_ok%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f); END IF;
  END LOOP; END $$;
