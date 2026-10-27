CREATE OR REPLACE FUNCTION public.can_manage_collaborators() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_super_admin() OR (public.has_role(auth.uid(),'admin') AND EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id=auth.uid() AND permission='collaborators_manage')) $$;
CREATE OR REPLACE FUNCTION public.can_manage_collaborator(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_super_admin() OR (public.can_manage_collaborators() AND public.has_role(_user_id,'admin') AND NOT public.has_role(_user_id,'super_admin')) $$;
REVOKE ALL ON FUNCTION public.can_manage_collaborators() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_collaborator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_collaborators(), public.can_manage_collaborator(uuid) TO authenticated, service_role;
CREATE POLICY us_delegate_insert_team ON public.user_schools FOR INSERT TO authenticated WITH CHECK (public.can_manage_collaborators() AND public.has_role(user_id,'admin') AND NOT public.has_role(user_id,'super_admin') AND public.can_see_school(school_id));
CREATE POLICY us_delegate_delete_team ON public.user_schools FOR DELETE TO authenticated USING (public.can_manage_collaborators() AND public.has_role(user_id,'admin') AND NOT public.has_role(user_id,'super_admin') AND public.can_see_school(school_id));
CREATE POLICY ts_delegate_insert ON public.team_supervision FOR INSERT TO authenticated WITH CHECK (public.can_manage_collaborators() AND public.can_manage_collaborator(supervisor_id) AND public.can_manage_collaborator(member_id) AND supervisor_id<>member_id);
CREATE POLICY ts_delegate_delete ON public.team_supervision FOR DELETE TO authenticated USING (public.can_manage_collaborators() AND public.can_manage_collaborator(supervisor_id) AND public.can_manage_collaborator(member_id));
CREATE OR REPLACE FUNCTION public.set_collaborator_scope(_user_id uuid, _scope text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.can_manage_collaborator(_user_id) THEN RAISE EXCEPTION 'Você não pode alterar este colaborador.'; END IF;
IF _scope NOT IN ('all','list') OR _scope IS NULL THEN RAISE EXCEPTION 'Escopo inválido.'; END IF;
UPDATE public.profiles SET admin_scope=_scope WHERE user_id=_user_id;
INSERT INTO public.user_access_changes(actor_id,target_user_id,action) VALUES(auth.uid(),_user_id,'alterou_escopo_' || _scope);
END $$;
REVOKE ALL ON FUNCTION public.set_collaborator_scope(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_collaborator_scope(uuid,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.transfer_portfolio(_from uuid,_to uuid,_school_ids uuid[]) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_count integer:=0; v_sid uuid; BEGIN
IF NOT public.can_manage_collaborator(_from) OR NOT public.can_manage_collaborator(_to) THEN RAISE EXCEPTION 'Você não pode transferir esta carteira.'; END IF;
IF NOT public.has_role(_to,'admin') OR _from=_to THEN RAISE EXCEPTION 'Escolha outra pessoa da equipe.'; END IF;
FOREACH v_sid IN ARRAY _school_ids LOOP
IF NOT public.can_see_school(v_sid) THEN RAISE EXCEPTION 'Empresa indisponível.'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.user_schools WHERE user_id=_from AND school_id=v_sid) THEN RAISE EXCEPTION 'Empresa não pertence à carteira de origem.'; END IF;
INSERT INTO public.user_schools(user_id,school_id) SELECT _to,v_sid WHERE NOT EXISTS(SELECT 1 FROM public.user_schools WHERE user_id=_to AND school_id=v_sid);
DELETE FROM public.user_schools WHERE user_id=_from AND school_id=v_sid;
INSERT INTO public.school_management_settings(school_id,responsible_user_id) VALUES(v_sid,_to) ON CONFLICT(school_id) DO UPDATE SET responsible_user_id=_to;
v_count:=v_count+1;
END LOOP; RETURN v_count; END $$;
REVOKE ALL ON FUNCTION public.transfer_portfolio(uuid,uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_portfolio(uuid,uuid,uuid[]) TO authenticated,service_role;