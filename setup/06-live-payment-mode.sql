-- Run ONCE in Supabase SQL Editor before deploying live checkout.
-- Existing test orders remain tagged test. New checkout orders are tagged live.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'test';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_mode_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_mode_check CHECK (payment_mode IN ('test','live'));
