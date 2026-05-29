alter table public.projects
  add column if not exists framework text not null default 'cloudflare-worker-supabase',
  add column if not exists repo_name text not null default '',
  add column if not exists github_org text not null default 'PALX-software',
  add column if not exists subdomain text not null default '',
  add column if not exists supabase_project_ref text,
  add column if not exists supabase_project_url text,
  add column if not exists cloudflare_zone text not null default 'zeqhora.com',
  add column if not exists provisioning_status jsonb not null default '{}'::jsonb;

create index if not exists projects_repo_name_idx on public.projects (repo_name);
create index if not exists projects_subdomain_idx on public.projects (subdomain);
