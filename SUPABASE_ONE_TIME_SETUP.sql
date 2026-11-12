-- Run ONCE in Supabase > SQL Editor before deploying this version.
create table if not exists public.store_settings (
 id integer primary key check (id=1),
 offline boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.store_settings(id,offline) values(1,false) on conflict(id) do nothing;
alter table public.store_settings enable row level security;
revoke all on public.store_settings from anon,authenticated;
grant select on public.store_settings to anon,authenticated;
drop policy if exists "Public can read store availability" on public.store_settings;
create policy "Public can read store availability" on public.store_settings for select to anon,authenticated using(true);
-- Writes are only made by the server with its service role key, after admin verification.
