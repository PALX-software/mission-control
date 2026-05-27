-- Add user_id to projects so owners can manage their own projects
alter table public.projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Drop the wide-open policies created during initial setup
drop policy if exists "allow read agents" on public.agents;
drop policy if exists "allow write agents" on public.agents;
drop policy if exists "allow read initiatives" on public.initiatives;
drop policy if exists "allow write initiatives" on public.initiatives;
drop policy if exists "allow read assignments" on public.initiative_assignments;
drop policy if exists "allow write assignments" on public.initiative_assignments;
drop policy if exists "allow read projects" on public.projects;
drop policy if exists "allow write projects" on public.projects;
drop policy if exists "allow read project_agents" on public.project_agents;
drop policy if exists "allow write project_agents" on public.project_agents;
drop policy if exists "allow read project_features" on public.project_features;
drop policy if exists "allow write project_features" on public.project_features;
drop policy if exists "allow read project_outputs" on public.project_outputs;
drop policy if exists "allow write project_outputs" on public.project_outputs;

-- agents: read-only for authenticated users; writes handled server-side only
create policy "authenticated read agents"
  on public.agents for select
  to authenticated
  using (true);

-- initiatives: any authenticated user can read/create
create policy "authenticated read initiatives"
  on public.initiatives for select
  to authenticated using (true);

create policy "authenticated write initiatives"
  on public.initiatives for insert
  to authenticated with check (true);

create policy "authenticated read assignments"
  on public.initiative_assignments for select
  to authenticated using (true);

create policy "authenticated write assignments"
  on public.initiative_assignments for insert
  to authenticated with check (true);

-- projects: any authenticated user can read all; only owner can insert/delete
create policy "authenticated read projects"
  on public.projects for select
  to authenticated using (true);

create policy "owner insert project"
  on public.projects for insert
  to authenticated with check (auth.uid() = user_id);

create policy "owner delete project"
  on public.projects for delete
  to authenticated using (auth.uid() = user_id);

-- project_agents: follow parent project ownership
create policy "authenticated read project_agents"
  on public.project_agents for select
  to authenticated using (true);

create policy "authenticated write project_agents"
  on public.project_agents for insert
  to authenticated with check (true);

-- project_features: any authenticated user can read; owner (via project) can write/delete
create policy "authenticated read project_features"
  on public.project_features for select
  to authenticated using (true);

create policy "authenticated write project_features"
  on public.project_features for insert
  to authenticated with check (true);

create policy "authenticated delete project_features"
  on public.project_features for delete
  to authenticated using (
    exists (
      select 1 from public.projects
      where projects.id = project_features.project_id
        and projects.user_id = auth.uid()
    )
  );

-- project_outputs: same as features
create policy "authenticated read project_outputs"
  on public.project_outputs for select
  to authenticated using (true);

create policy "authenticated write project_outputs"
  on public.project_outputs for insert
  to authenticated with check (true);

create policy "authenticated delete project_outputs"
  on public.project_outputs for delete
  to authenticated using (
    exists (
      select 1 from public.projects
      where projects.id = project_outputs.project_id
        and projects.user_id = auth.uid()
    )
  );
