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

  SELECT count(*), (array_agg(c.user_id))[1]
  INTO v_count, v_only
  FROM (
    SELECT DISTINCT us.user_id
    FROM public.user_schools us
    JOIN public.profiles p ON p.user_id = us.user_id AND p.admin_scope = 'list'
    JOIN public.user_roles ur ON ur.user_id = us.user_id AND ur.role = 'admin'::public.app_role
    WHERE us.school_id = _school_id
  ) c;

  INSERT INTO public.school_management_settings (school_id, responsible_user_id)
  VALUES (_school_id, CASE WHEN v_count = 1 THEN v_only ELSE NULL END)
  ON CONFLICT (school_id) DO UPDATE
  SET responsible_user_id = CASE WHEN v_count = 1 THEN v_only ELSE NULL END;
END;
$$;