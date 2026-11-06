-- Run ONCE in Supabase SQL Editor after deploying the updated test package.
-- All currently listed shirt products are R395, print-on-demand.
UPDATE public.products SET price_cents=39500;
-- The app ignores stock counts for print-on-demand.
SELECT slug,name,price_cents FROM public.products ORDER BY name;
