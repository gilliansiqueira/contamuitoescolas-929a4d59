
-- Add tipo column to conversion_data
ALTER TABLE public.conversion_data 
ADD COLUMN tipo text NOT NULL DEFAULT 'ativo';

-- Create conversion_icons table for custom card icons
CREATE TABLE public.conversion_icons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL,
  card_key text NOT NULL,
  file_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(school_id, card_key)
);

ALTER TABLE public.conversion_icons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversion_icons" ON public.conversion_icons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversion_icons" ON public.conversion_icons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversion_icons" ON public.conversion_icons FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete conversion_icons" ON public.conversion_icons FOR DELETE USING (true);
