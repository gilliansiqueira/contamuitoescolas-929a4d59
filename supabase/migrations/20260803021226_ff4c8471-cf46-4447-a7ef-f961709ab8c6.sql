ALTER TABLE public.payment_delay_rules
ADD COLUMN IF NOT EXISTS weekend_policy text NOT NULL DEFAULT 'proximo';

ALTER TABLE public.payment_delay_rules
DROP CONSTRAINT IF EXISTS payment_delay_rules_weekend_policy_check;

ALTER TABLE public.payment_delay_rules
ADD CONSTRAINT payment_delay_rules_weekend_policy_check
CHECK (weekend_policy IN ('anterior','proximo','manter'));