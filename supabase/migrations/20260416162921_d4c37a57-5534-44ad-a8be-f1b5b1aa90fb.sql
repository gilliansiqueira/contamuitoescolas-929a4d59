
-- Conversion templates (reusable models)
CREATE TABLE public.conversion_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversion_templates" ON public.conversion_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversion_templates" ON public.conversion_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversion_templates" ON public.conversion_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete conversion_templates" ON public.conversion_templates FOR DELETE USING (true);

-- Conversion template items (thresholds + icons per tipo)
CREATE TABLE public.conversion_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.conversion_templates(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'ativo',
  thresholds JSONB NOT NULL DEFAULT '[]'::jsonb,
  icon_contatos_url TEXT,
  icon_matriculas_url TEXT,
  icon_conversao_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversion_template_items" ON public.conversion_template_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversion_template_items" ON public.conversion_template_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversion_template_items" ON public.conversion_template_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete conversion_template_items" ON public.conversion_template_items FOR DELETE USING (true);
