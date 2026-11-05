# FAITH BY SOX — Supabase Admin Upgrade

This update retains the existing editorial storefront styling and adds a Supabase-backed product catalogue, a Supabase Authentication admin login, product image uploads, and product/variant stock management.

## IMPORTANT: Not yet ready for customer orders

Cart is local to the browser. **There is no live checkout, Yoco integration, payment verification, order capture, or stock reservation.** Do not advertise the site as accepting orders yet. The main landing page still contains a static campaign image and static colour-gallery images; the live product catalogue below them comes from Supabase.

## Installation

1. Run `setup/02-store-setup.sql` in the existing FaithBySox Supabase SQL Editor. This adds three sample products with **zero stock**, their size/colour combinations and a secured image storage bucket. It assumes you already ran the first database setup and granted your user admin membership.
2. Upload the **contents of this ZIP**, not the enclosing folder, to the root of the existing GitHub repository, replacing existing matching files. GitHub/Vercel should deploy automatically.
3. In Vercel Production environment variables, keep `NEXT_PUBLIC_SUPABASE_URL` set to your Supabase URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to the **sb_publishable_** key. Do not use `sb_secret_` or service-role keys in any NEXT_PUBLIC variable.
4. Visit `/admin` and sign in with the email/password for the Supabase Auth user already listed in `store_admins`.
5. Set correct variant stock and prices, upload photos, and save. The products should appear in the catalogue on the home page.

## Notes

- The SQL in `setup/02-store-setup.sql` must be run manually once. The app will not create database tables by itself.
- Existing data is not overwritten by the seed SQL.
- Only admins have write permissions in Supabase RLS. Public users can read active products and their variants.
- Product image uploads are limited to 5 MB and JPEG/PNG/WebP.
- The hero/campaign and four colour gallery images remain deliberately unchanged to preserve the approved design.
- Do not commit `.env` files or secret API keys to GitHub.
- Test the admin login and product saving before changing any product to active.
- The site is a commercial project; verify that your Vercel plan permits commercial use before launch.
