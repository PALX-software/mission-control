alter table public.projects
  add column if not exists status text not null default 'active' check (status in ('active','paused','done','archived')),
  add column if not exists project_type text not null default 'general',
  add column if not exists learning_summary text not null default '',
  add column if not exists cycle_count integer not null default 0 check (cycle_count >= 0),
  add column if not exists last_cycle_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.initiatives
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  initiative_id uuid references public.initiatives(id) on delete set null,
  title text not null,
  detail text not null default '',
  owner_agent_key text not null default 'Product Strategist',
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'queued' check (status in ('queued','running','blocked','done')),
  source_cycle_number integer,
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  initiative_id uuid references public.initiatives(id) on delete set null,
  ai_run_id uuid references public.ai_runs(id) on delete set null,
  name text not null,
  artifact_type text not null default 'doc' check (artifact_type in ('doc','code','qa_report','legal_review','launch_asset')),
  content text not null,
  source_cycle_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists initiatives_project_id_idx on public.initiatives (project_id, created_at desc);
create index if not exists project_tasks_project_status_idx on public.project_tasks (project_id, status, created_at desc);
create index if not exists project_artifacts_project_created_idx on public.project_artifacts (project_id, created_at desc);

alter table public.project_tasks enable row level security;
alter table public.project_artifacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'allow update projects'
  ) then
    create policy "allow update projects" on public.projects for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_tasks' and policyname = 'allow read project_tasks'
  ) then
    create policy "allow read project_tasks" on public.project_tasks for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_tasks' and policyname = 'allow write project_tasks'
  ) then
    create policy "allow write project_tasks" on public.project_tasks for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_tasks' and policyname = 'allow update project_tasks'
  ) then
    create policy "allow update project_tasks" on public.project_tasks for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_artifacts' and policyname = 'allow read project_artifacts'
  ) then
    create policy "allow read project_artifacts" on public.project_artifacts for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_artifacts' and policyname = 'allow write project_artifacts'
  ) then
    create policy "allow write project_artifacts" on public.project_artifacts for insert with check (true);
  end if;
end $$;
