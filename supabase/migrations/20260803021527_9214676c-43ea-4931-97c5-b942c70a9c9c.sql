ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS allow_weekend_entries boolean NOT NULL DEFAULT false;

UPDATE public.schools
SET allow_weekend_entries = true
WHERE id = '58cbf0b4-027e-4124-813c-3b6a6bfde87a';