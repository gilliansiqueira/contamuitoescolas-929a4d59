
-- Table for conversion data (contatos + matriculas per month)
CREATE TABLE public.conversion_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  month TEXT NOT NULL,
  contatos INTEGER NOT NULL DEFAULT 0,
  matriculas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, month)
);

ALTER TABLE public.conversion_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversion_data" ON public.conversion_data FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversion_data" ON public.conversion_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversion_data" ON public.conversion_data FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete conversion_data" ON public.conversion_data FOR DELETE USING (true);

-- Table for conversion performance thresholds
CREATE TABLE public.conversion_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  color TEXT NOT NULL DEFAULT 'hsl(142 71% 45%)',
  label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversion_thresholds" ON public.conversion_thresholds FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversion_thresholds" ON public.conversion_thresholds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversion_thresholds" ON public.conversion_thresholds FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete conversion_thresholds" ON public.conversion_thresholds FOR DELETE USING (true);

-- Table for module tab visibility per school
CREATE TABLE public.module_tabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  tab_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, tab_key)
);

ALTER TABLE public.module_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read module_tabs" ON public.module_tabs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert module_tabs" ON public.module_tabs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update module_tabs" ON public.module_tabs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete module_tabs" ON public.module_tabs FOR DELETE USING (true);
