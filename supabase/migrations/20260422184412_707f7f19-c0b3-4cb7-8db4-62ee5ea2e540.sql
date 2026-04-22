-- Tabela de vínculos extras usuário ↔ escola (N:N adicional ao profiles.school_id)
CREATE TABLE IF NOT EXISTS public.user_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);

ALTER TABLE public.user_schools ENABLE ROW LEVEL SECURITY;

-- Apenas admins gerenciam vínculos
CREATE POLICY "us_admin_all" ON public.user_schools
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Usuário pode visualizar os próprios vínculos
CREATE POLICY "us_select_own" ON public.user_schools
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Função auxiliar: verifica se o usuário tem acesso a uma escola específica
CREATE OR REPLACE FUNCTION public.user_has_school_access(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND school_id = _school_id)
    OR EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _user_id AND school_id = _school_id);
$$;

CREATE INDEX IF NOT EXISTS idx_user_schools_user ON public.user_schools(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schools_school ON public.user_schools(school_id);