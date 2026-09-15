create table if not exists public.plant_actions (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null,
  plant_type text not null check (plant_type in ('plants', 'indoor_plants', 'bonsai')),
  type text not null check (type in ('potata', 'concimata')),
  performed_at timestamptz not null,
  user_id uuid references auth.users(id) on delete set null,
  legacy_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists plant_actions_plant_idx
  on public.plant_actions (plant_type, plant_id, performed_at desc);

create index if not exists plant_actions_performed_at_idx
  on public.plant_actions (performed_at desc);

alter table public.plant_actions enable row level security;

revoke all on table public.plant_actions from anon;
grant select, insert, update, delete on table public.plant_actions to authenticated;

drop policy if exists "Authenticated users can view plant actions" on public.plant_actions;
create policy "Authenticated users can view plant actions"
  on public.plant_actions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert plant actions" on public.plant_actions;
create policy "Authenticated users can insert plant actions"
  on public.plant_actions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id or user_id is null);

drop policy if exists "Authenticated users can update plant actions" on public.plant_actions;
create policy "Authenticated users can update plant actions"
  on public.plant_actions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete plant actions" on public.plant_actions;
create policy "Authenticated users can delete plant actions"
  on public.plant_actions
  for delete
  to authenticated
  using (true);
