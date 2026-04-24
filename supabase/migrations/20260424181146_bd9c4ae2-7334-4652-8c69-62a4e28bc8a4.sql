
-- ============================================================
-- 1) Pastas (1 nível, sem hierarquia)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.icon_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.icon_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "if_select" ON public.icon_folders FOR SELECT USING (true);
CREATE POLICY "if_insert" ON public.icon_folders FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "if_update" ON public.icon_folders FOR UPDATE USING (public.is_admin());
CREATE POLICY "if_delete" ON public.icon_folders FOR DELETE USING (public.is_admin());

-- ============================================================
-- 2) Biblioteca unificada de ícones (sempre globais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.icons_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_url text NOT NULL,
  folder_id uuid REFERENCES public.icon_folders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icons_library_folder ON public.icons_library(folder_id);
CREATE INDEX IF NOT EXISTS idx_icons_library_url ON public.icons_library(file_url);

ALTER TABLE public.icons_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "il_select" ON public.icons_library FOR SELECT USING (true);
CREATE POLICY "il_insert" ON public.icons_library FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "il_update" ON public.icons_library FOR UPDATE USING (public.is_admin());
CREATE POLICY "il_delete" ON public.icons_library FOR DELETE USING (public.is_admin());

-- ============================================================
-- 3) Migrar ícones existentes (todos viram globais)
-- ============================================================

-- 3a) De kpi_icons
INSERT INTO public.icons_library (id, name, file_url, created_at)
SELECT
  k.id,                       -- preserva o id para manter relação com kpi_definitions.icon_id
  COALESCE(NULLIF(trim(k.name), ''), 'Ícone'),
  k.file_url,
  k.created_at
FROM public.kpi_icons k
WHERE NOT EXISTS (
  SELECT 1 FROM public.icons_library l WHERE l.file_url = k.file_url
)
ON CONFLICT (id) DO NOTHING;

-- 3b) De sa_icons (sem conflito de id porque kpi_icons já entraram)
INSERT INTO public.icons_library (name, file_url, created_at)
SELECT
  COALESCE(NULLIF(trim(s.name), ''), 'Ícone'),
  s.file_url,
  s.created_at
FROM public.sa_icons s
WHERE NOT EXISTS (
  SELECT 1 FROM public.icons_library l WHERE l.file_url = s.file_url
);

-- ============================================================
-- 4) Pastas iniciais sugeridas
-- ============================================================
INSERT INTO public.icon_folders (name, sort_order) VALUES
  ('Indicadores', 1),
  ('Produtos',    2),
  ('Pagamentos',  3),
  ('Categorias',  4),
  ('Outros',      99)
ON CONFLICT DO NOTHING;
