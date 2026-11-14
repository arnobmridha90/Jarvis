-- Jarvis talks to Arnob's Claude projects: one assistant (the project's coordinator) per project.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  channel_id text,                       -- claude project id (chan_…)
  coordinator_session text,              -- session that receives Jarvis's requests
  threads jsonb not null default '{}',   -- session_id -> { title }
  status_summary text,                   -- latest one-paragraph status, written by the dispatcher
  needs_you text,                        -- anything waiting on Arnob
  checked_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,   -- null = let Jarvis pick
  text text not null,
  via text not null default 'typed',
  status text not null default 'pending' check (status in ('pending','sent','done','failed','cancelled')),
  target_session text,
  reply text,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index commands_pending on public.commands(status, created_at);
create trigger commands_touch before update on public.commands for each row execute function public.touch();

alter table public.settings add column dispatch_minutes smallint not null default 15
  check (dispatch_minutes in (5, 10, 15, 30, 60));

do $$
declare t text;
begin
  foreach t in array array['projects','commands'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy owner_all on public.%I for all to authenticated
                     using (public.is_owner() and user_id = auth.uid())
                     with check (public.is_owner() and user_id = auth.uid())$p$, t);
  end loop;
end $$;

alter publication supabase_realtime add table public.projects, public.commands;
