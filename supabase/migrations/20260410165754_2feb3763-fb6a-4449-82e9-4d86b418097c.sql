
-- Templates table
CREATE TABLE public.kpi_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read kpi_templates" ON public.kpi_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kpi_templates" ON public.kpi_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kpi_templates" ON public.kpi_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kpi_templates" ON public.kpi_templates FOR DELETE USING (true);

-- Template items
CREATE TABLE public.kpi_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.kpi_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  value_type text NOT NULL DEFAULT 'percent',
  direction text NOT NULL DEFAULT 'higher_is_better',
  sort_order integer NOT NULL DEFAULT 0,
  thresholds jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read kpi_template_items" ON public.kpi_template_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kpi_template_items" ON public.kpi_template_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kpi_template_items" ON public.kpi_template_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kpi_template_items" ON public.kpi_template_items FOR DELETE USING (true);

-- Insert default "Modelo Escolas"
INSERT INTO public.kpi_templates (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Modelo Escolas');

INSERT INTO public.kpi_template_items (template_id, name, value_type, direction, sort_order, thresholds) VALUES
('00000000-0000-0000-0000-000000000001', 'Lucratividade', 'percent', 'higher_is_better', 0,
 '[{"min_value":null,"max_value":10,"color":"#ef4444","label":"Ruim"},{"min_value":10,"max_value":15,"color":"#eab308","label":"Regular"},{"min_value":15,"max_value":20,"color":"#3b82f6","label":"Bom"},{"min_value":25,"max_value":null,"color":"#22c55e","label":"Ótimo"}]'),
('00000000-0000-0000-0000-000000000001', 'Inadimplência', 'percent', 'lower_is_better', 1,
 '[{"min_value":3,"max_value":null,"color":"#ef4444","label":"Ruim"},{"min_value":2.5,"max_value":3,"color":"#eab308","label":"Regular"},{"min_value":2,"max_value":2.5,"color":"#3b82f6","label":"Bom"},{"min_value":null,"max_value":2,"color":"#22c55e","label":"Ótimo"}]'),
('00000000-0000-0000-0000-000000000001', 'Média Alunos/Turma', 'number', 'higher_is_better', 2,
 '[{"min_value":null,"max_value":3,"color":"#ef4444","label":"Ruim"},{"min_value":3,"max_value":4,"color":"#eab308","label":"Regular"},{"min_value":4,"max_value":6,"color":"#3b82f6","label":"Bom"},{"min_value":6,"max_value":null,"color":"#22c55e","label":"Ótimo"}]'),
('00000000-0000-0000-0000-000000000001', 'Alunos por Modalidade', 'percent', 'higher_is_better', 3,
 '[{"min_value":null,"max_value":70,"color":"#ef4444","label":"Ruim"},{"min_value":70,"max_value":75,"color":"#eab308","label":"Regular"},{"min_value":75,"max_value":80,"color":"#3b82f6","label":"Bom"},{"min_value":80,"max_value":null,"color":"#22c55e","label":"Ótimo"}]'),
('00000000-0000-0000-0000-000000000001', 'Evasão', 'percent', 'lower_is_better', 4,
 '[{"min_value":3.5,"max_value":null,"color":"#ef4444","label":"Ruim"},{"min_value":3,"max_value":3.5,"color":"#eab308","label":"Regular"},{"min_value":2.5,"max_value":3,"color":"#3b82f6","label":"Bom"},{"min_value":null,"max_value":2.5,"color":"#22c55e","label":"Ótimo"}]');
