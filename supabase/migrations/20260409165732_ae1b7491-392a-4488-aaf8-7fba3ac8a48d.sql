
-- Storage bucket for KPI icons
INSERT INTO storage.buckets (id, name, public) VALUES ('kpi-icons', 'kpi-icons', true);

-- Storage policies
CREATE POLICY "KPI icons are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'kpi-icons');

CREATE POLICY "Anyone can upload KPI icons"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'kpi-icons');

CREATE POLICY "Anyone can update KPI icons"
ON storage.objects FOR UPDATE
USING (bucket_id = 'kpi-icons');

CREATE POLICY "Anyone can delete KPI icons"
ON storage.objects FOR DELETE
USING (bucket_id = 'kpi-icons');

-- Icon library
CREATE TABLE public.kpi_icons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.kpi_icons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read kpi_icons" ON public.kpi_icons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kpi_icons" ON public.kpi_icons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kpi_icons" ON public.kpi_icons FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kpi_icons" ON public.kpi_icons FOR DELETE USING (true);

-- Indicator definitions
CREATE TABLE public.kpi_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon_id UUID REFERENCES public.kpi_icons(id) ON DELETE SET NULL,
  value_type TEXT NOT NULL DEFAULT 'percent',
  direction TEXT NOT NULL DEFAULT 'higher_is_better',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read kpi_definitions" ON public.kpi_definitions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kpi_definitions" ON public.kpi_definitions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kpi_definitions" ON public.kpi_definitions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kpi_definitions" ON public.kpi_definitions FOR DELETE USING (true);

-- Performance thresholds/zones
CREATE TABLE public.kpi_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kpi_definition_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  min_value NUMERIC,
  max_value NUMERIC,
  color TEXT NOT NULL DEFAULT 'hsl(142 71% 45%)',
  label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.kpi_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read kpi_thresholds" ON public.kpi_thresholds FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kpi_thresholds" ON public.kpi_thresholds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kpi_thresholds" ON public.kpi_thresholds FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kpi_thresholds" ON public.kpi_thresholds FOR DELETE USING (true);

-- Monthly values
CREATE TABLE public.kpi_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  kpi_definition_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (school_id, kpi_definition_id, month)
);
ALTER TABLE public.kpi_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read kpi_values" ON public.kpi_values FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kpi_values" ON public.kpi_values FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kpi_values" ON public.kpi_values FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kpi_values" ON public.kpi_values FOR DELETE USING (true);
