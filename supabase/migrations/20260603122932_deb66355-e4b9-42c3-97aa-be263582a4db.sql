-- 1) FK backstop: garante CASCADE no banco — não dá mais pra deixar órfão
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_origem_upload_id_fkey
  FOREIGN KEY (origem_upload_id)
  REFERENCES public.upload_records(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_fe_origem_upload_id
  ON public.financial_entries(origem_upload_id);

-- 2) Colunas de rastreabilidade
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('import','manual','manual_edit')),
  ADD COLUMN IF NOT EXISTS source_file text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill: tudo que tem origem_upload_id veio de importação
UPDATE public.financial_entries fe
SET source_kind = 'import',
    source_file = ur.file_name,
    imported_at = ur.uploaded_at
FROM public.upload_records ur
WHERE fe.origem_upload_id = ur.id
  AND fe.source_kind = 'manual';

-- 3) Proteção contra re-upload do mesmo arquivo (mesma escola + tipo)
-- Evita dobrar dados quando o usuário sobe o mesmo arquivo duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_upload_records_school_file_tipo
  ON public.upload_records(school_id, file_name, tipo);

-- 4) Defaults de rastreabilidade para colunas legadas
ALTER TABLE public.financial_entries
  ALTER COLUMN source_kind SET DEFAULT 'manual';