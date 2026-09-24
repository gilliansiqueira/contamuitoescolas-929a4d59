CREATE OR REPLACE FUNCTION public.sync_school_management_responsible(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current uuid;
  v_count integer;
  v_only uuid;
BEGIN
  SELECT responsible_user_id INTO v_current
  FROM public.school_management_settings
  WHERE school_id = _school_id;

  IF v_current IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_schools us
    JOIN public.profiles p ON p.user_id = us.user_id AND p.admin_scope = 'list'
    JOIN public.user_roles ur ON ur.user_id = us.user_id AND ur.role = 'admin'::public.app_role
    WHERE us.school_id = _school_id AND us.user_id = v_current
  ) THEN
    RETURN;
  END IF;

  SELECT count(DISTINCT us.user_id), min(us.user_id)
  INTO v_count, v_only
  FROM public.user_schools us
  JOIN public.profiles p ON p.user_id = us.user_id AND p.admin_scope = 'list'
  JOIN public.user_roles ur ON ur.user_id = us.user_id AND ur.role = 'admin'::public.app_role
  WHERE us.school_id = _school_id;

  INSERT INTO public.school_management_settings (school_id, responsible_user_id)
  VALUES (_school_id, CASE WHEN v_count = 1 THEN v_only ELSE NULL END)
  ON CONFLICT (school_id) DO UPDATE
  SET responsible_user_id = CASE WHEN v_count = 1 THEN v_only ELSE NULL END;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_school_management_responsible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_school_management_responsible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_school_management_responsible_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_school_management_responsible(CASE WHEN TG_OP = 'DELETE' THEN OLD.school_id ELSE NEW.school_id END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER sync_management_responsible_after_access
AFTER INSERT OR DELETE ON public.user_schools
FOR EACH ROW EXECUTE FUNCTION public.sync_school_management_responsible_trigger();

CREATE OR REPLACE FUNCTION public.get_management_responsible_candidates()
RETURNS TABLE (school_id uuid, user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à proprietária.';
  END IF;

  RETURN QUERY
  SELECT DISTINCT us.school_id, p.user_id, p.email
  FROM public.user_schools us
  JOIN public.profiles p ON p.user_id = us.user_id AND p.admin_scope = 'list'
  JOIN public.user_roles ur ON ur.user_id = us.user_id AND ur.role = 'admin'::public.app_role
  ORDER BY us.school_id, p.email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_management_responsible_candidates() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_management_responsible_candidates() FROM anon;

CREATE OR REPLACE FUNCTION public.set_management_responsible(_school_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à proprietária.';
  END IF;

  IF _user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_schools us
    JOIN public.profiles p ON p.user_id = us.user_id AND p.admin_scope = 'list'
    JOIN public.user_roles ur ON ur.user_id = us.user_id AND ur.role = 'admin'::public.app_role
    WHERE us.school_id = _school_id AND us.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'A responsável precisa ter esta empresa liberada no login.';
  END IF;

  INSERT INTO public.school_management_settings (school_id, responsible_user_id)
  VALUES (_school_id, _user_id)
  ON CONFLICT (school_id) DO UPDATE SET responsible_user_id = EXCLUDED.responsible_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_management_responsible(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_management_responsible(uuid, uuid) FROM anon;

CREATE TRIGGER audit_school_management_settings
AFTER INSERT OR UPDATE OR DELETE ON public.school_management_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_management_change();