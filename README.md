# FAITH BY SOX — mobile storefront prototype

A mobile-first Next.js storefront concept for **FAITH BY SOX**, Collection 001: **FOR HIS GLORY**.

## Run locally

1. Install Node.js 20.9 or later.
2. In this folder run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.
5. Open `/admin` for the **local demo** product editor.

## What works in this prototype

- Mobile storefront with the approved black/cream editorial design direction.
- Product listings and individual product pages.
- Size and colour selection, optional variant-level stock, demo shopping bag.
- Admin demo: create, edit and delete products; price, description, colours, sizes, variant stock, visibility and image upload.
- Product changes and cart saved in **browser localStorage only**.

## IMPORTANT — not production-ready

The admin route has **no authentication** and **must not be published as-is**. Product data is local to each browser, uploads use data URLs with a 1.5 MB demo limit, and the cart has **no checkout, payment, order storage or shipping logic**. The listed prices are placeholders, not confirmed retail prices. Replace illustrative CSS garment artwork with your approved product photography before launch.

## Next production phase

- Supabase Auth (admin-only), Postgres tables for products, variants, stock, orders and order lines, and Supabase Storage for product images.
- Server-side stock validation and transactional order creation.
- PayFast hosted checkout with server-side signature validation, IPN notification verification, and idempotent payment reconciliation; never mark an order paid based solely on a browser redirect.
- Shipping zones/rates, delivery addresses, POPIA/privacy and return policies, order confirmation email.
- Deploy on Vercel and connect faithbysox.co.za after confirming registration.

## Design

Single-column mobile-focused presentation with a 490px max-width desktop preview. Uses DM Sans and Playfair Display from Google Fonts (requires internet). All artwork is illustrative until approved photographs are supplied.
