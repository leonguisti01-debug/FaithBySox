-- FAITH BY SOX: Run once in Supabase SQL Editor before deploying admin notifications.
-- Independent tracking ensures customer emails are unaffected.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_admin_order_notification(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE claimed_id uuid;
BEGIN
  UPDATE public.orders
  SET admin_email_status = 'sending',
      admin_email_claimed_at = now()
  WHERE id = p_order_id
    AND payment_status = 'paid'
    AND (admin_email_status = 'pending'
         OR (admin_email_status = 'sending'
             AND admin_email_claimed_at < now() - interval '10 minutes'))
  RETURNING id INTO claimed_id;
  RETURN claimed_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_admin_order_notification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_order_notification(uuid) TO service_role;
