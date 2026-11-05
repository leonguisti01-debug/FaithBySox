# FAITH BY SOX — YOCO TEST CHECKOUT (NOT LIVE)

This ZIP includes a TEST-only Yoco hosted checkout and a signed webhook receiver. It deliberately refuses `sk_live_` keys. Do NOT take real customer payments yet. There is no production stock reservation, expiry handling, shipping rate logic, fulfilment workflow, or complete payment reconciliation.

## Required Vercel Production environment variables

- `YOCO_SECRET_KEY`: your **newly rotated** `sk_test_...` key (server-side only). The earlier key was visible in a screenshot; rotate it in Yoco before testing.
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase **service_role** secret, configured ONLY in Vercel (NEVER in GitHub, screenshots or a `NEXT_PUBLIC_` variable). Find in Supabase Project Settings > API Keys; it may be labelled legacy service_role or a newer server secret key. The code expects a key with service-role privileges. Keep existing Supabase public variables.
- `YOCO_WEBHOOK_SECRET`: the `whsec_...` signing secret returned when you register a TEST webhook with Yoco. This is different from the test API key.

The webhook endpoint is `https://faithbysox.co.za/api/yoco-webhook`.

Register this endpoint with Yoco Checkout API `POST https://payments.yoco.com/api/webhooks` using the TEST secret key, and securely save the returned signing secret in Vercel. Verify registration fields against Yoco's current developer documentation. Do not expose secrets in chat or screenshots. Redeploy after adding environment variables.

## Testing

1. Add a product and positive stock in `/admin` (existing admin remains unchanged).
2. Add product to bag, open `/checkout`, and use Yoco-provided **test** card details.
3. Check Yoco test transactions and the Supabase `orders` / `order_items` tables. `payment_status` starts `pending` and only changes from a verified webhook.
4. A return page is NOT proof of payment.
5. Webhook event payload shapes may change; test with Yoco's actual test events and check Vercel logs before relying on status updates.

## IMPORTANT — before accepting real orders

Implement transactional stock reservations with release/expiry, reliable order-payment matching and idempotent webhook processing, delivery rates and address validation, error/retry reconciliation, and privacy/returns policies. Review RLS on the existing tables. Switch to live credentials only after domain approval and a verified end-to-end live readiness review. This build deliberately blocks live keys.

## Deploy

Upload the ZIP **contents** to the GitHub repository root, replacing existing matching files, and let Vercel deploy. Do not upload the enclosing folder. Existing admin and product data are not overwritten. No new SQL is required for the existing table columns supplied.
