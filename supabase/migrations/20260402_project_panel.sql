create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text not null,
  scope_definition text not null,
  audience text not null,
  constraints text not null,
  risk_level text not null check (risk_level in ('low','medium','high')),
  discovery_mode boolean not null default true,
  github_repo text not null check (github_repo like 'https://github.com/%'),
  prompt_blueprint text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_key text not null,
  assignment_reason text not null,
  mode text not null check (mode in ('auto','hybrid','manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.project_features (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  detail text not null,
  status text not null check (status in ('discovered','ready','in_progress','done')),
  created_at timestamptz not null default now()
);

create table if not exists public.project_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  output_type text not null check (output_type in ('doc','code','qa_report','legal_review','launch_asset')),
  definition text not null,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_agents enable row level security;
alter table public.project_features enable row level security;
alter table public.project_outputs enable row level security;

create policy "allow read projects" on public.projects for select using (true);
create policy "allow write projects" on public.projects for insert with check (true);

create policy "allow read project_agents" on public.project_agents for select using (true);
create policy "allow write project_agents" on public.project_agents for insert with check (true);

create policy "allow read project_features" on public.project_features for select using (true);
create policy "allow write project_features" on public.project_features for insert with check (true);

create policy "allow read project_outputs" on public.project_outputs for select using (true);
create policy "allow write project_outputs" on public.project_outputs for insert with check (true);
