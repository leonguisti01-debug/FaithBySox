-- FAITH BY SOX: Run once in Supabase SQL Editor before testing emails.
-- No existing order, payment, product, or design data is changed.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmation_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;

-- Atomic, concurrent-safe email claim. Only paid orders can be claimed.
-- Stale claims may be retried after ten minutes if an email send failed.
CREATE OR REPLACE FUNCTION public.claim_order_confirmation(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE claimed_id uuid;
BEGIN
  UPDATE public.orders
  SET confirmation_email_status = 'sending',
      confirmation_email_claimed_at = now()
  WHERE id = p_order_id
    AND payment_status = 'paid'
    AND (confirmation_email_status = 'pending'
         OR (confirmation_email_status = 'sending'
             AND confirmation_email_claimed_at < now() - interval '10 minutes'))
  RETURNING id INTO claimed_id;
  RETURN claimed_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_order_confirmation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_confirmation(uuid) TO service_role;
