-- Run in Supabase SQL editor

-- Profiles (auth-linked)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Add profile link to players
alter table public.players
  add column if not exists profile_id uuid references public.profiles(id);

-- Extend room_state for match tracking
alter table public.room_state
  add column if not exists round_counts jsonb default '{}'::jsonb,
  add column if not exists finish_triggered boolean default false,
  add column if not exists finish_until_player_id uuid,
  add column if not exists finish_winner_ids uuid[] default '{}',
  add column if not exists match_id uuid,
  add column if not exists finalized_at timestamptz,
  add column if not exists started_at timestamptz;

-- Matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  ended_at timestamptz not null,
  month_key text not null,
  total_players int not null,
  winners_count int not null,
  created_at timestamptz not null default now()
);

create index if not exists matches_month_key_idx on public.matches(month_key);

-- Match players
create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  is_winner boolean not null default false,
  rounds int,
  points_awarded numeric(6,2) not null default 0,
  month_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists match_players_month_key_idx on public.match_players(month_key);
create index if not exists match_players_profile_idx on public.match_players(profile_id);
create index if not exists match_players_match_idx on public.match_players(match_id);

-- Player state theme snapshot for inspect view
alter table public.player_state
  add column if not exists theme_snapshot jsonb default '{}'::jsonb;
