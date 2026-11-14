-- Jarvis: single-owner personal assistant schema.
-- The first account that signs up becomes the owner; every other account is locked out by RLS.

create extension if not exists pgcrypto;

create table public.owner (
  id boolean primary key default true check (id),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.claim_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.owner (user_id) values (new.id) on conflict (id) do nothing;
  if exists (select 1 from public.owner where user_id = new.id) then
    insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owner where user_id = auth.uid());
$$;

-- Settings: one row, edited from the app's Settings screen.
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Singapore',
  briefing_times text[] not null default array['08:30','14:30','21:00'],
  briefings_paused boolean not null default false,
  quiet_days smallint[] not null default '{}',          -- 0 = Sunday … 6 = Saturday
  suggestions_per_day smallint not null default 3 check (suggestions_per_day between 0 and 10),
  sources jsonb not null default jsonb_build_object(
    'gmail', true, 'calendar', true, 'drive', true, 'threads', true,
    'screenshots', true, 'health', false, 'browsing', true, 'voice', true
  ),
  voice_enabled boolean not null default false,
  learning_paused boolean not null default false,
  updated_at timestamptz not null default now()
);

-- What Jarvis knows about Arnob. Grows every night; fully viewable, editable, deletable.
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact text not null,
  category text not null default 'general',   -- preference, habit, goal, person, place, health, money, work, general
  source text not null default 'you',         -- gmail, calendar, drive, threads, screenshots, health, voice, feedback, you
  source_ref text,
  confidence real not null default 0.7 check (confidence between 0 and 1),
  pinned boolean not null default false,
  times_seen integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memories_user_cat on public.memories(user_id, category);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  why text,
  kind text not null default 'nudge',          -- nudge, warning, idea, reminder
  status text not null default 'new' check (status in ('new','done','dismissed')),
  feedback smallint not null default 0 check (feedback between -1 and 1),
  created_at timestamptz not null default now()
);

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  due_at timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  area text,
  cuisine text,
  notes text,
  source_ref text,
  visited boolean not null default false,
  created_at timestamptz not null default now()
);

-- Things Arnob tells Jarvis in the app ("Tell Jarvis…"). The nightly run turns these into memories/actions.
create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  via text not null default 'typed',           -- typed, voice
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.learning_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ran_at timestamptz not null default now(),
  sources_read text[] not null default '{}',
  facts_added integer not null default 0,
  facts_updated integer not null default 0,
  suggestions_added integer not null default 0,
  notes text
);

-- updated_at upkeep
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger settings_touch before update on public.settings for each row execute function public.touch();
create trigger memories_touch before update on public.memories for each row execute function public.touch();

-- RLS: owner only, on every table.
do $$
declare t text;
begin
  foreach t in array array['settings','memories','suggestions','briefings','reminders','restaurants','inbox','learning_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy owner_all on public.%I for all to authenticated
                     using (public.is_owner() and user_id = auth.uid())
                     with check (public.is_owner() and user_id = auth.uid())$p$, t);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
  end loop;
end $$;

alter table public.owner enable row level security;
create policy owner_read on public.owner for select to authenticated using (user_id = auth.uid());

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.claim_owner();

-- Live sync between devices.
alter publication supabase_realtime add table
  public.settings, public.memories, public.suggestions, public.briefings,
  public.reminders, public.restaurants, public.inbox;

-- Private bucket for screenshots Arnob shares from his phone (restaurants, flights, anything).
insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false)
  on conflict (id) do nothing;
create policy screenshots_owner on storage.objects for all to authenticated
  using (bucket_id = 'screenshots' and public.is_owner())
  with check (bucket_id = 'screenshots' and public.is_owner());
