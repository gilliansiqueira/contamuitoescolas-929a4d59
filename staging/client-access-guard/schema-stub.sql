-- Cópia MÍNIMA do ambiente (stubs). Funções de permissão copiadas do código das migrations.
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
-- STUB: auth.uid() lê a claim configurada pelo teste (no backend real vem do JWT).
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
CREATE TYPE public.app_role AS ENUM ('admin','cliente','super_admin');
CREATE TABLE public.schools (id uuid PRIMARY KEY, nome text, restrita boolean NOT NULL DEFAULT false, ativo boolean NOT NULL DEFAULT true);
CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE, email text NOT NULL, school_id uuid, admin_scope text NOT NULL DEFAULT 'own');
CREATE TABLE public.user_schools (user_id uuid, school_id uuid, PRIMARY KEY (user_id, school_id));
CREATE TABLE public.user_roles (user_id uuid, role public.app_role, PRIMARY KEY (user_id, role));
CREATE TABLE public.user_permissions (user_id uuid, permission text, PRIMARY KEY (user_id, permission));
CREATE TABLE public.team_supervision (supervisor_id uuid, member_id uuid);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
-- Copiadas: 0013 (is_super_admin), supabase/20260419 (is_admin), 0066 (can_see_school), 0113 (user_has_school_access), 0080 (admin_manages_school)
CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role) $$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(), 'admin'::app_role) $$;
CREATE FUNCTION public.can_see_school(_school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _school_id IS NULL OR public.has_role(auth.uid(), 'super_admin'::public.app_role) OR auth.uid() IS NULL
    OR NOT COALESCE((SELECT s.restrita FROM public.schools s WHERE s.id = _school_id), false) $$;
CREATE FUNCTION public.user_has_school_access(_user_id uuid, _school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND school_id = _school_id)
     OR EXISTS (SELECT 1 FROM public.user_schools WHERE user_id = _user_id AND school_id = _school_id)
     OR EXISTS (SELECT 1 FROM public.team_supervision ts JOIN public.user_schools us ON us.user_id = ts.member_id WHERE ts.supervisor_id = _user_id AND us.school_id = _school_id))
    AND (COALESCE((SELECT s.ativo FROM public.schools s WHERE s.id = _school_id), true) OR public.has_role(_user_id, 'admin'::public.app_role) OR public.has_role(_user_id, 'super_admin'::public.app_role)) $$;
CREATE FUNCTION public.admin_manages_school(_school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR (public.is_admin() AND public.can_see_school(_school_id) AND (
    public.user_has_school_access(auth.uid(), _school_id) OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND admin_scope = 'all'))) $$;
-- Como no backend: funções novas podem ser executadas por PUBLIC até serem revogadas.
