create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

create index if not exists activity_logs_user_id_idx
  on public.activity_logs (user_id, created_at desc);

alter table public.activity_logs enable row level security;

revoke all on table public.activity_logs from anon;
grant select, insert on table public.activity_logs to authenticated;

drop policy if exists "Admins can view activity logs" on public.activity_logs;
create policy "Admins can view activity logs"
  on public.activity_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.ruolo = 'admin'
    )
  );

drop policy if exists "Authenticated users can insert activity logs" on public.activity_logs;
create policy "Authenticated users can insert activity logs"
  on public.activity_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);
