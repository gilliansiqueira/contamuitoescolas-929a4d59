-- Migration for Sales (Vendas) tables
CREATE TABLE public.sales_payment_methods (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL,
    payment_method text NOT NULL,
    card_brand text,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sales_payment_methods_pkey PRIMARY KEY (id),
    CONSTRAINT sales_payment_methods_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT sales_payment_methods_unique UNIQUE (school_id, payment_method, card_brand)
);

CREATE TABLE public.sales_data (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL,
    month text NOT NULL,
    payment_method text NOT NULL,
    card_brand text,
    amount numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sales_data_pkey PRIMARY KEY (id),
    CONSTRAINT sales_data_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT sales_data_unique UNIQUE (school_id, month, payment_method, card_brand)
);

-- RLS policies
ALTER TABLE public.sales_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to sales_payment_methods" ON public.sales_payment_methods FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to sales_data" ON public.sales_data FOR ALL USING (auth.role() = 'authenticated');
