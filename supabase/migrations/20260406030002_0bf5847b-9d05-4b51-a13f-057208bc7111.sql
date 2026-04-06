
CREATE TABLE public.monthly_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  month TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, month)
);

ALTER TABLE public.monthly_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read monthly_revenue" ON public.monthly_revenue FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert monthly_revenue" ON public.monthly_revenue FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update monthly_revenue" ON public.monthly_revenue FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete monthly_revenue" ON public.monthly_revenue FOR DELETE TO public USING (true);
