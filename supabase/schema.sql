-- RallyOps Database Schema
-- Run this in your Supabase SQL Editor: supabase.com → your project → SQL Editor

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Orgs ────────────────────────────────────────────────────────────────────
create table if not exists orgs (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,  -- e.g. "my-club" or "rallyops-qatar"
  logo_url    text,
  created_at  timestamptz default now()
);

-- ─── Player Profiles ─────────────────────────────────────────────────────────
-- One row per Supabase Auth user. Created on first login.
create table if not exists player_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null,
  mobile          text,
  gender          text check (gender in ('male', 'female')),
  dob             date,
  avatar_url      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Tournaments ─────────────────────────────────────────────────────────────
create table if not exists tournaments (
  id                    uuid primary key default uuid_generate_v4(),
  org_id                uuid references orgs(id) on delete cascade,
  name                  text not null,
  sport                 text not null default 'badminton',
  venue                 text,
  event_date            date,
  registration_open_at  timestamptz,
  registration_close_at timestamptz,
  status                text not null default 'upcoming'
                          check (status in ('upcoming', 'open', 'live', 'completed')),
  -- Rules & eligibility (shown to players before registration)
  rules                 text,
  eligibility           text,
  entry_fee             numeric(10,2) default 0,
  max_participants      int,
  categories            text[] default array['male_singles','female_singles','male_doubles','female_doubles','spouse_doubles'],
  cover_image_url       text,
  created_by            uuid references auth.users(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ─── Registrations ───────────────────────────────────────────────────────────
create table if not exists registrations (
  id                uuid primary key default uuid_generate_v4(),
  tournament_id     uuid references tournaments(id) on delete cascade,
  player_id         uuid references player_profiles(id) on delete cascade,
  category          text not null,
  partner_id        uuid references player_profiles(id),  -- for doubles
  partner_name      text,                                  -- if partner not yet on platform
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  registration_code text unique default 'REG-' || upper(substr(md5(random()::text), 1, 6)),
  emergency_contact text,
  notes             text,
  payment_status    text default 'unpaid' check (payment_status in ('unpaid','paid','waived')),
  payment_ref       text,
  approved_by       uuid references auth.users(id),
  approved_at       timestamptz,
  created_at        timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table orgs              enable row level security;
alter table player_profiles   enable row level security;
alter table tournaments       enable row level security;
alter table registrations     enable row level security;

-- Tournaments: anyone can read, only org admins can write (we'll add admin roles later)
create policy "tournaments_public_read" on tournaments
  for select using (true);

-- Player profiles: users can read all (for partner lookup), only own row to write
create policy "profiles_public_read" on player_profiles
  for select using (true);

create policy "profiles_own_insert" on player_profiles
  for insert with check (auth.uid() = id);

create policy "profiles_own_update" on player_profiles
  for update using (auth.uid() = id);

-- Registrations: player can see their own, admins see all (admin policy added later)
create policy "registrations_own_read" on registrations
  for select using (auth.uid() = player_id);

create policy "registrations_own_insert" on registrations
  for insert with check (auth.uid() = player_id);

create policy "registrations_own_withdraw" on registrations
  for update using (auth.uid() = player_id and status = 'pending');

-- ─── Sample Org (replace with your org name and slug) ────────────────────────
-- insert into orgs (name, slug) values ('My Badminton Club', 'my-club')
--   on conflict (slug) do nothing;

-- ─── Sample Tournament ────────────────────────────────────────────────────────
-- After creating an org, copy its id from Table Editor → orgs, then run:
--
-- insert into tournaments (org_id, name, sport, venue, event_date, status, registration_close_at, eligibility, rules, entry_fee, categories)
-- values (
--   'PASTE-ORG-ID-HERE',
--   'Summer Open 2026',
--   'badminton',
--   'Main Sports Hall',
--   '2026-09-15',
--   'open',
--   '2026-08-31 23:59:00+00',
--   'Open to all registered members. Age 16+. Medical fitness required.',
--   '1. Matches follow BWF scoring rules (21 points, best of 3 sets).
-- 2. Players must report to court 10 minutes before scheduled time.
-- 3. No-show after 10 minutes = walkover.
-- 4. Disputes resolved by the umpire on court.',
--   50,
--   array['male_singles','female_singles','male_doubles','female_doubles','spouse_doubles']
-- );
