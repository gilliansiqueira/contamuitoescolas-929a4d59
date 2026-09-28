ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS inativado_em timestamptz NULL;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS inativado_por uuid NULL;

CREATE OR REPLACE FUNCTION public.user_has_school_access(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND school_id = _school_id)
     OR EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _user_id AND school_id = _school_id))
    AND (
      COALESCE((SELECT s.ativo FROM public.schools s WHERE s.id = _school_id), true)
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR public.has_role(_user_id, 'super_admin'::public.app_role)
    );
$$;

CREATE OR REPLACE FUNCTION public.sync_school_active_to_management()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    INSERT INTO public.school_management_settings (school_id, is_active)
    VALUES (NEW.id, NEW.ativo)
    ON CONFLICT (school_id) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();
    INSERT INTO public.audit_log (school_id, action, description)
    VALUES (NEW.id, CASE WHEN NEW.ativo THEN 'empresa_reativada' ELSE 'empresa_inativada' END,
            CASE WHEN NEW.ativo THEN 'Empresa reativada' ELSE 'Empresa inativada (histórico preservado)' END);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_school_active ON public.schools;
CREATE TRIGGER trg_sync_school_active AFTER UPDATE OF ativo ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.sync_school_active_to_management();