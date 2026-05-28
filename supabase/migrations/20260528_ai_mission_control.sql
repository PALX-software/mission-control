alter table public.initiatives
  add column if not exists objective text not null default '',
  add column if not exists summary text not null default '',
  add column if not exists ai_status text not null default 'queued',
  add column if not exists ai_model text not null default '',
  add column if not exists ai_response jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.initiative_assignments
  add column if not exists agent_role text not null default '',
  add column if not exists assignment_reason text not null default '',
  add column if not exists next_action text not null default '';

create table if not exists public.initiative_steps (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null,
  owner_agent_key text not null,
  detail text not null,
  status text not null default 'queued' check (status in ('queued','running','blocked','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.initiative_outputs (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  name text not null,
  output_type text not null check (output_type in ('doc','code','qa_report','legal_review','launch_asset')),
  definition text not null,
  status text not null default 'queued' check (status in ('queued','running','blocked','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  initiative_id uuid references public.initiatives(id) on delete cascade,
  provider text not null default 'openai',
  model text not null,
  status text not null check (status in ('completed','fallback','failed')),
  prompt text not null,
  response jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.initiative_steps enable row level security;
alter table public.initiative_outputs enable row level security;
alter table public.ai_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiatives' and policyname = 'allow update initiatives'
  ) then
    create policy "allow update initiatives" on public.initiatives for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_assignments' and policyname = 'allow update assignments'
  ) then
    create policy "allow update assignments" on public.initiative_assignments for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_steps' and policyname = 'allow read initiative_steps'
  ) then
    create policy "allow read initiative_steps" on public.initiative_steps for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_steps' and policyname = 'allow write initiative_steps'
  ) then
    create policy "allow write initiative_steps" on public.initiative_steps for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_steps' and policyname = 'allow update initiative_steps'
  ) then
    create policy "allow update initiative_steps" on public.initiative_steps for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_outputs' and policyname = 'allow read initiative_outputs'
  ) then
    create policy "allow read initiative_outputs" on public.initiative_outputs for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_outputs' and policyname = 'allow write initiative_outputs'
  ) then
    create policy "allow write initiative_outputs" on public.initiative_outputs for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'initiative_outputs' and policyname = 'allow update initiative_outputs'
  ) then
    create policy "allow update initiative_outputs" on public.initiative_outputs for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_runs' and policyname = 'allow read ai_runs'
  ) then
    create policy "allow read ai_runs" on public.ai_runs for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_runs' and policyname = 'allow write ai_runs'
  ) then
    create policy "allow write ai_runs" on public.ai_runs for insert with check (true);
  end if;
end $$;
