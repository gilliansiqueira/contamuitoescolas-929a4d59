-- Make card brands global (shared across all schools)
ALTER TABLE public.sales_card_brands ALTER COLUMN school_id DROP NOT NULL;