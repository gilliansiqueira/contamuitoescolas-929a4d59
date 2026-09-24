CREATE OR REPLACE FUNCTION public.sync_school_management_responsible(_school_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_current uuid; v_count integer; v_only uuid; v_keep boolean;
BEGIN
  SELECT responsible_user_id INTO v_current FROM public.school_management_settings WHERE school_id = _school_id;
  WITH c AS (
    SELECT us.user_id FROM public.user_schools us WHERE us.school_id = _school_id
    UNION SELECT p.user_id FROM public.profiles p WHERE p.school_id = _school_id
  ), cand AS (
    SELECT DISTINCT c.user_id FROM c
    JOIN public.profiles p ON p.user_id = c.user_id AND p.admin_scope IN ('list','all')
    JOIN public.user_roles ur ON ur.user_id = c.user_id AND ur.role = 'admin'::public.app_role
  )
  SELECT count(*), (array_agg(user_id))[1], coalesce(bool_or(user_id = v_current), false)
  INTO v_count, v_only, v_keep FROM cand;
  IF v_keep THEN RETURN; END IF;
  INSERT INTO public.school_management_settings (school_id, responsible_user_id)
  VALUES (_school_id, CASE WHEN v_count = 1 THEN v_only ELSE NULL END)
  ON CONFLICT (school_id) DO UPDATE
  SET responsible_user_id = CASE WHEN v_count = 1 THEN v_only ELSE NULL END;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_management_responsible_candidates()
 RETURNS TABLE(school_id uuid, user_id uuid, email text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso restrito à proprietária.'; END IF;
  RETURN QUERY
  SELECT DISTINCT x.school_id, p.user_id, p.email FROM (
    SELECT us.school_id, us.user_id FROM public.user_schools us
    UNION SELECT pp.school_id, pp.user_id FROM public.profiles pp WHERE pp.school_id IS NOT NULL
  ) x
  JOIN public.profiles p ON p.user_id = x.user_id AND p.admin_scope IN ('list','all')
  JOIN public.user_roles ur ON ur.user_id = x.user_id AND ur.role = 'admin'::public.app_role
  ORDER BY x.school_id, p.email;
END; $function$;