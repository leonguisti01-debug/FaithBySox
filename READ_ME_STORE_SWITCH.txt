FAITH BY SOX — ADMIN ONLINE / OFFLINE SWITCH

ONE-TIME SETUP (required):
1. Open your Supabase project > SQL Editor.
2. Paste and run SUPABASE_ONE_TIME_SETUP.sql. This creates one setting row, initially ONLINE.
3. Upload this complete project to GitHub (replace existing files; keep your Vercel environment variables).
4. Wait for the Vercel deployment to succeed.
5. Visit /admin, sign in and use STORE CONTROL.

OFFLINE: Visitors see the approved maintenance image. Admin and backend routes stay accessible. New checkout attempts are blocked server-side. Existing Yoco webhooks and orders continue working.
ONLINE: Storefront and checkout are restored without redeployment.

IMPORTANT: If your repository has a separate middleware.ts or proxy.ts not included in this uploaded ZIP, review it before replacing. This release uses Next.js 16 proxy.ts.
The public storefront check fails open if Supabase cannot be reached. Checkout fails closed if store mode cannot be verified.
