CREATE TABLE public.user_access_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  target_user_id uuid,
  school_id uuid,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_access_changes TO authenticated;
GRANT ALL ON public.user_access_changes TO service_role;
ALTER TABLE public.user_access_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY uac_select ON public.user_access_changes FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.is_client_user(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.admin_manages_school(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR (public.is_admin() AND public.can_see_school(_school_id) AND (
    EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = auth.uid() AND school_id = _school_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND (school_id = _school_id OR admin_scope = 'all'))
  ))
$$;

CREATE OR REPLACE FUNCTION public.log_user_schools_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_access_changes(actor_id, target_user_id, school_id, action)
  VALUES (auth.uid(), COALESCE(NEW.user_id, OLD.user_id), COALESCE(NEW.school_id, OLD.school_id),
          CASE WHEN TG_OP = 'INSERT' THEN 'vinculou_empresa' ELSE 'desvinculou_empresa' END);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_log_user_schools ON public.user_schools;
CREATE TRIGGER trg_log_user_schools AFTER INSERT OR DELETE ON public.user_schools
FOR EACH ROW EXECUTE FUNCTION public.log_user_schools_change();

-- profiles: só proprietária altera/exclui
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Super admin deletes profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admin updates profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin inserts profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());

-- user_roles: só proprietária
DROP POLICY IF EXISTS "Admins can delete roles of others" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can grant roles to others" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles of others" ON public.user_roles;
CREATE POLICY "Super admin deletes roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_super_admin() AND user_id <> auth.uid());
CREATE POLICY "Super admin grants roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() AND user_id <> auth.uid());
CREATE POLICY "Super admin updates roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_super_admin() AND user_id <> auth.uid()) WITH CHECK (public.is_super_admin() AND user_id <> auth.uid());

-- user_schools: proprietária tudo; equipe só clientes nas empresas da própria carteira
DROP POLICY IF EXISTS us_admin_all ON public.user_schools;
CREATE POLICY us_super_all ON public.user_schools FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY us_team_insert_clients ON public.user_schools FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND public.is_client_user(user_id) AND public.admin_manages_school(school_id));
CREATE POLICY us_team_delete_clients ON public.user_schools FOR DELETE TO authenticated
  USING (public.is_admin() AND public.is_client_user(user_id) AND public.admin_manages_school(school_id));

-- responsável: liga a empresa na carteira automaticamente
CREATE OR REPLACE FUNCTION public.set_management_responsible(_school_id uuid, _user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso restrito à proprietária.'; END IF;
  IF _user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN
      RAISE EXCEPTION 'A responsável precisa ser da equipe.';
    END IF;
    INSERT INTO public.user_schools(user_id, school_id)
    SELECT _user_id, _school_id
    WHERE NOT EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _user_id AND school_id = _school_id);
  END IF;
  INSERT INTO public.school_management_settings (school_id, responsible_user_id)
  VALUES (_school_id, _user_id)
  ON CONFLICT (school_id) DO UPDATE SET responsible_user_id = EXCLUDED.responsible_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_portfolio(_from uuid, _to uuid, _school_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_sid uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso restrito à proprietária.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _to AND role = 'admin') THEN
    RAISE EXCEPTION 'Destino precisa ser da equipe.';
  END IF;
  FOREACH v_sid IN ARRAY _school_ids LOOP
    INSERT INTO public.user_schools(user_id, school_id) SELECT _to, v_sid
      WHERE NOT EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _to AND school_id = v_sid);
    DELETE FROM public.user_schools WHERE user_id = _from AND school_id = v_sid;
    INSERT INTO public.school_management_settings (school_id, responsible_user_id) VALUES (v_sid, _to)
      ON CONFLICT (school_id) DO UPDATE SET responsible_user_id = _to;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.transfer_portfolio(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manages_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_user(uuid) TO authenticated;