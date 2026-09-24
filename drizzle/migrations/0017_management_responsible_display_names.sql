CREATE TABLE public.management_responsible_display_names (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60),
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.management_responsible_display_names TO authenticated;
GRANT ALL ON public.management_responsible_display_names TO service_role;
ALTER TABLE public.management_responsible_display_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authorized staff view responsible display names"
ON public.management_responsible_display_names
FOR SELECT TO authenticated
USING (public.is_admin());
CREATE POLICY "Super admins manage responsible display names"
ON public.management_responsible_display_names
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin() AND updated_by = auth.uid());
CREATE TRIGGER touch_management_responsible_display_names
BEFORE UPDATE ON public.management_responsible_display_names
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_management_responsible_display_names()
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe autorizada.';
  END IF;

  RETURN QUERY
  SELECT d.user_id, d.display_name
  FROM public.management_responsible_display_names d
  WHERE EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = d.user_id
      AND ur.role = 'admin'::public.app_role
  )
  ORDER BY d.display_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_management_responsible_display_names() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_management_responsible_display_names() FROM anon;

CREATE OR REPLACE FUNCTION public.set_management_responsible_display_name(_user_id uuid, _display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := regexp_replace(btrim(COALESCE(_display_name, '')), '\s+', ' ', 'g');
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso restrito à proprietária.';
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'O nome deve ter entre 1 e 60 caracteres.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'A responsável informada não é uma administradora.';
  END IF;

  INSERT INTO public.management_responsible_display_names (user_id, display_name, updated_by)
  VALUES (_user_id, v_name, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      updated_by = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_management_responsible_display_name(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_management_responsible_display_name(uuid, text) FROM anon;