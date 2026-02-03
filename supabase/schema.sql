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
  add column if not exists finish_until_round int,
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

-- Friends
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete cascade,
  addressee_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists friend_requests_unique_idx
  on public.friend_requests(requester_id, addressee_id);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  friend_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists friends_unique_idx
  on public.friends(user_id, friend_id);

-- Room invites
create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create unique index if not exists room_invites_unique_idx
  on public.room_invites(room_id, recipient_profile_id);

-- Room chat messages
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_player_id uuid references public.players(id) on delete set null,
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_room_idx on public.room_messages(room_id);

-- Blitz events
create table if not exists public.blitz_events (
  id uuid primary key default gen_random_uuid(),
  date_key text not null unique,
  room_id uuid references public.rooms(id) on delete set null,
  status text not null default 'lobby',
  award_points boolean not null default true,
  lobby_open_at timestamptz not null,
  start_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  last_elim_at timestamptz,
  next_elim_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.blitz_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.blitz_events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  eliminated_at timestamptz,
  eliminated_seq int
);

create unique index if not exists blitz_participants_unique_idx
  on public.blitz_participants(event_id, profile_id);

create index if not exists blitz_participants_event_idx
  on public.blitz_participants(event_id);

-- Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_unique_idx
  on public.push_subscriptions(profile_id, endpoint);
