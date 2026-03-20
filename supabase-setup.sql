create extension if not exists pgcrypto;

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  water integer,
  sleep numeric(4,1),
  steps integer,
  calories integer,
  weight numeric(5,1),
  mood text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_date)
);

create table if not exists public.health_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  water integer not null default 2000,
  sleep numeric(4,1) not null default 8,
  steps integer not null default 8000,
  calories integer not null default 1800,
  weight numeric(5,1) not null default 60,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists health_records_set_updated_at on public.health_records;
create trigger health_records_set_updated_at
before update on public.health_records
for each row
execute function public.set_updated_at();

drop trigger if exists health_goals_set_updated_at on public.health_goals;
create trigger health_goals_set_updated_at
before update on public.health_goals
for each row
execute function public.set_updated_at();

alter table public.health_records enable row level security;
alter table public.health_goals enable row level security;

drop policy if exists "health_records_select_own" on public.health_records;
create policy "health_records_select_own"
on public.health_records
for select
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_records_insert_own" on public.health_records;
create policy "health_records_insert_own"
on public.health_records
for insert
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_records_update_own" on public.health_records;
create policy "health_records_update_own"
on public.health_records
for update
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_records_delete_own" on public.health_records;
create policy "health_records_delete_own"
on public.health_records
for delete
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_goals_select_own" on public.health_goals;
create policy "health_goals_select_own"
on public.health_goals
for select
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_goals_insert_own" on public.health_goals;
create policy "health_goals_insert_own"
on public.health_goals
for insert
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_goals_update_own" on public.health_goals;
create policy "health_goals_update_own"
on public.health_goals
for update
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "health_goals_delete_own" on public.health_goals;
create policy "health_goals_delete_own"
on public.health_goals
for delete
using (auth.uid() is not null and auth.uid() = user_id);
