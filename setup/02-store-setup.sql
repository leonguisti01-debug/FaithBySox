-- FAITH BY SOX - run once in Supabase SQL Editor.
-- Requires the five tables and RLS policies from the first setup.
-- Safe to rerun: existing products and variants are not overwritten.

insert into public.products (name,slug,description,collection_name,price_cents,images,active)
values
 ('FAITH OVER FEAR','faith-over-fear','Psalm 118:6 — The Lord is on my side; I will not fear.','FOR HIS GLORY',29900,array['/faith-cream.webp'],true),
 ('FORGIVEN','forgiven','Psalm 32:1 — Blessed is the one whose transgressions are forgiven.','FOR HIS GLORY',29900,array['/forgiven-back.webp'],true),
 ('FOR HIS GLORY','glory','1 Corinthians 10:31 — Whatever you do, do it all for the glory of God.','FOR HIS GLORY',29900,array['/glory-back.webp'],true)
on conflict (slug) do nothing;

-- Stock begins at zero so unavailable merchandise cannot be purchased accidentally.
insert into public.product_variants (product_id,colour,size,stock_quantity)
select p.id,c.colour,s.size,0
from public.products p
cross join (values ('Black'),('White'),('Cream'),('Brown')) c(colour)
cross join (values ('XS'),('S'),('M'),('L'),('XL'),('2XL'),('3XL'),('4XL'),('5XL')) s(size)
where p.slug in ('faith-over-fear','forgiven','glory')
on conflict (product_id,colour,size) do nothing;

-- Publicly readable product images, upload and delete restricted to store admins.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Public view store product images" on storage.objects;
drop policy if exists "Store admins upload product images" on storage.objects;
drop policy if exists "Store admins delete product images" on storage.objects;
create policy "Public view store product images" on storage.objects for select to anon,authenticated
using (bucket_id='product-images');
create policy "Store admins upload product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and (select public.is_store_admin()));
create policy "Store admins delete product images" on storage.objects for delete to authenticated
using (bucket_id='product-images' and (select public.is_store_admin()));

select (select count(*) from public.products) as products,
       (select count(*) from public.product_variants) as variants;
