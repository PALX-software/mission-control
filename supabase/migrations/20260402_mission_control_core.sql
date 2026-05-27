create extension if not exists "pgcrypto";

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  automation_level text not null check (automation_level in ('auto','hybrid','manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.initiatives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scope_text text not null,
  stage text not null check (stage in ('discover','plan','build','validate','launch')),
  risk_level text not null check (risk_level in ('low','medium','high')),
  created_at timestamptz not null default now()
);

create table if not exists public.initiative_assignments (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  agent_key text not null,
  status text not null default 'queued' check (status in ('queued','running','blocked','done')),
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;
alter table public.initiatives enable row level security;
alter table public.initiative_assignments enable row level security;

create policy "allow read agents" on public.agents for select using (true);
create policy "allow write agents" on public.agents for insert with check (true);

create policy "allow read initiatives" on public.initiatives for select using (true);
create policy "allow write initiatives" on public.initiatives for insert with check (true);

create policy "allow read assignments" on public.initiative_assignments for select using (true);
create policy "allow write assignments" on public.initiative_assignments for insert with check (true);
