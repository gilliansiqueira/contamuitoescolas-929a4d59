ALTER TABLE public.product_sales_monthly ADD COLUMN ranking text NOT NULL DEFAULT 'valor';
ALTER TABLE public.product_sales_monthly ADD CONSTRAINT product_sales_monthly_ranking_check CHECK (ranking IN ('valor','quantidade'));
ALTER TABLE public.product_sales_monthly DROP CONSTRAINT product_sales_monthly_school_id_month_produto_key;
ALTER TABLE public.product_sales_monthly ADD CONSTRAINT product_sales_monthly_school_month_ranking_produto_key UNIQUE (school_id, month, ranking, produto);
INSERT INTO public.product_sales_monthly (school_id, month, produto, valor, quantidade, ranking)
SELECT school_id, month, produto, valor, quantidade, 'quantidade' FROM public.product_sales_monthly WHERE ranking = 'valor';