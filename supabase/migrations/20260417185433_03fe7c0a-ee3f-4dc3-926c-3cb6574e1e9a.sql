-- Sales payment methods per school
CREATE TABLE public.sales_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  method_key TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, method_key)
);

ALTER TABLE public.sales_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sales_payment_methods" ON public.sales_payment_methods FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sales_payment_methods" ON public.sales_payment_methods FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sales_payment_methods" ON public.sales_payment_methods FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sales_payment_methods" ON public.sales_payment_methods FOR DELETE USING (true);

-- Sales card brands per school
CREATE TABLE public.sales_card_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_card_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sales_card_brands" ON public.sales_card_brands FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sales_card_brands" ON public.sales_card_brands FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sales_card_brands" ON public.sales_card_brands FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sales_card_brands" ON public.sales_card_brands FOR DELETE USING (true);

-- Sales data (monthly values)
CREATE TABLE public.sales_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  method_key TEXT NOT NULL,
  brand_id UUID,
  month TEXT NOT NULL, -- YYYY-MM
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sales_data_unique_with_brand
  ON public.sales_data (school_id, method_key, month, brand_id)
  WHERE brand_id IS NOT NULL;

CREATE UNIQUE INDEX sales_data_unique_no_brand
  ON public.sales_data (school_id, method_key, month)
  WHERE brand_id IS NULL;

ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sales_data" ON public.sales_data FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sales_data" ON public.sales_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sales_data" ON public.sales_data FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete sales_data" ON public.sales_data FOR DELETE USING (true);

-- Storage bucket for card brand icons
INSERT INTO storage.buckets (id, name, public) VALUES ('card-brand-icons', 'card-brand-icons', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Card brand icons publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'card-brand-icons');
CREATE POLICY "Anyone can upload card brand icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'card-brand-icons');
CREATE POLICY "Anyone can update card brand icons" ON storage.objects FOR UPDATE USING (bucket_id = 'card-brand-icons');
CREATE POLICY "Anyone can delete card brand icons" ON storage.objects FOR DELETE USING (bucket_id = 'card-brand-icons');