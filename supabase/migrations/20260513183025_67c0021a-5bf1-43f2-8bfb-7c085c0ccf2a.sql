ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_scope text NOT NULL DEFAULT 'all';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_admin_scope_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_admin_scope_check CHECK (admin_scope IN ('all','list'));