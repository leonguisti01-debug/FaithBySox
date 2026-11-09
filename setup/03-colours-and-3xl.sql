-- FAITH BY SOX: run once in Supabase SQL Editor, preferably test database first.
-- Matches YAHWEH / FORGIVEN colour images and CAP colour images.
-- Adds 3XL for shirts; does not modify prices or existing orders.
begin;
create temporary table fbs_targets (product_id uuid, colour text) on commit drop;
insert into fbs_targets
select p.id,c.colour from public.products p cross join
(values ('Yellow'),('Terracotta'),('Green Melange'),('Grey Melange')) c(colour)
where lower(p.name) in ('yahweh','forgiven')
union all
select p.id,c.colour from public.products p cross join
(values ('Black'),('Navy'),('Olive'),('Beige')) c(colour)
where lower(p.name) in ('cap','caps');
-- Add 3XL for all products with shirt sizes, using only the correct target colours where specified.
insert into public.product_variants(product_id,colour,size,stock_quantity)
select distinct p.id,v.colour,'3XL',999999
from public.products p join public.product_variants v on v.product_id=p.id
where v.size in ('S','M','L','XL','2XL')
and (not exists(select 1 from fbs_targets t where t.product_id=p.id)
     or exists(select 1 from fbs_targets t where t.product_id=p.id and t.colour=v.colour))
on conflict (product_id,colour,size) do nothing;
-- Add pictured colours in each existing size (3XL included).
insert into public.product_variants(product_id,colour,size,stock_quantity)
select distinct t.product_id,t.colour,s.size,999999
from fbs_targets t
cross join lateral (select distinct size from public.product_variants v where v.product_id=t.product_id) s
on conflict (product_id,colour,size) do nothing;
-- Remove wrong colours only when not referenced by historical order items.
delete from public.product_variants v using public.products p
where v.product_id=p.id
and exists(select 1 from fbs_targets t where t.product_id=p.id)
and not exists(select 1 from fbs_targets t where t.product_id=p.id and t.colour=v.colour)
and not exists(select 1 from public.order_items oi where oi.variant_id=v.id);
commit;
-- REVIEW: any old colour tied to an order will remain and need manual reconciliation.
select p.name,v.colour,string_agg(distinct v.size,', ' order by v.size) sizes
from public.products p join public.product_variants v on v.product_id=p.id
group by p.name,v.colour order by p.name,v.colour;
