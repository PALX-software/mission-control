alter table public.initiatives
  add column if not exists learning_summary text not null default '',
  add column if not exists cycle_count integer not null default 0 check (cycle_count >= 0),
  add column if not exists last_cycle_at timestamptz;

alter table public.ai_runs
  add column if not exists cycle_number integer check (cycle_number > 0),
  add column if not exists instruction text not null default '',
  add column if not exists memory_snapshot jsonb not null default '{}'::jsonb;

create index if not exists ai_runs_initiative_cycle_idx
  on public.ai_runs (initiative_id, cycle_number desc, started_at desc);
