CREATE OR REPLACE FUNCTION public.sync_school_management_responsible(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current uuid;
  v_count integer;
  v_only uuid;
  v_keep boolean;
BEGIN
  -- During deletion of a school, cascading deletes and profile updates can fire
  -- responsibility-sync triggers after the parent row no longer exists.
  -- In that case there is nothing to synchronize and recreating settings would
  -- violate the foreign key back to schools.
  IF _school_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.schools WHERE id = _school_id
  ) THEN
    RETURN;
  END IF;

  SELECT responsible_user_id
  INTO v_current
  FROM public.school_management_settings
  WHERE school_id = _school_id;

  WITH c AS (
    SELECT us.user_id FROM public.user_schools us WHERE us.school_id = _school_id
    UNION
    SELECT p.user_id FROM public.profiles p WHERE p.school_id = _school_id
  ), cand AS (
    SELECT DISTINCT c.user_id
    FROM c
    JOIN public.profiles p
      ON p.user_id = c.user_id
     AND p.admin_scope IN ('list', 'all')
    JOIN public.user_roles ur
      ON ur.user_id = c.user_id
     AND ur.role = 'admin'::public.app_role
  )
  SELECT count(*), (array_agg(user_id))[1], coalesce(bool_or(user_id = v_current), false)
  INTO v_count, v_only, v_keep
  FROM cand;

  IF v_keep THEN
    RETURN;
  END IF;

  INSERT INTO public.school_management_settings (school_id, responsible_user_id)
  VALUES (_school_id, CASE WHEN v_count = 1 THEN v_only ELSE NULL END)
  ON CONFLICT (school_id) DO UPDATE
  SET responsible_user_id = CASE WHEN v_count = 1 THEN v_only ELSE NULL END;
END;
$function$;