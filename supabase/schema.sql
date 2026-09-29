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

-- Tournaments: anyone can read, any authenticated user can create
create policy "tournaments_public_read" on tournaments
  for select using (true);

create policy "tournaments_auth_insert" on tournaments
  for insert with check (auth.uid() = created_by);

create policy "tournaments_own_update" on tournaments
  for update using (auth.uid() = created_by);

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

-- ─── Matches ─────────────────────────────────────────────────────────────────
create table if not exists matches (
  id                uuid primary key default uuid_generate_v4(),
  tournament_id     uuid references tournaments(id) on delete cascade,
  category          text not null,
  round             int not null,
  player1_id        uuid references player_profiles(id),
  player1_name      text not null,
  player2_id        uuid references player_profiles(id),
  player2_name      text not null,
  court_id          text,
  referee_id        uuid references player_profiles(id),
  referee_name      text,
  status            text not null default 'upcoming'
                      check (status in ('upcoming', 'in_progress', 'completed')),
  winner_id         uuid references player_profiles(id),
  winner_name       text,
  scheduled_at      timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz default now()
);

-- ─── Match Sets (scores per set) ──────────────────────────────────────────
create table if not exists match_sets (
  id                uuid primary key default uuid_generate_v4(),
  match_id          uuid references matches(id) on delete cascade,
  set_number        int not null,
  player1_score     int not null default 0,
  player2_score     int not null default 0,
  created_at        timestamptz default now()
);

-- ─── Indexes for performance ─────────────────────────────────────────────
create index if not exists matches_tournament_idx on matches(tournament_id);
create index if not exists matches_category_idx on matches(category);
create index if not exists matches_status_idx on matches(status);
create index if not exists match_sets_match_idx on match_sets(match_id);

-- ─── RLS for Matches ─────────────────────────────────────────────────────
alter table matches        enable row level security;
alter table match_sets     enable row level security;

create policy "matches_public_read" on matches
  for select using (true);

create policy "match_sets_public_read" on match_sets
  for select using (true);

create policy "matches_org_insert" on matches
  for insert with check (
    exists (
      select 1 from tournaments t
      where t.id = matches.tournament_id
      and t.created_by = auth.uid()
    )
  );

create policy "match_sets_org_insert" on match_sets
  for insert with check (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_sets.match_id
      and t.created_by = auth.uid()
    )
  );

create policy "matches_org_update" on matches
  for update using (
    exists (
      select 1 from tournaments t
      where t.id = matches.tournament_id
      and t.created_by = auth.uid()
    )
  );

create policy "match_sets_org_update" on match_sets
  for update using (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_sets.match_id
      and t.created_by = auth.uid()
    )
  );

-- ─── Organizer visibility into registrations ────────────────────────────
create policy "registrations_org_read" on registrations
  for select using (
    exists (
      select 1 from tournaments t
      where t.id = registrations.tournament_id
      and t.created_by = auth.uid()
    )
  );

create policy "registrations_org_update" on registrations
  for update using (
    exists (
      select 1 from tournaments t
      where t.id = registrations.tournament_id
      and t.created_by = auth.uid()
    )
  );

-- ─── Tournament Staff (coaches, co-admins) ────────────────────────────────
create table if not exists tournament_staff (
  id            uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  email         text not null,
  name          text not null,
  role          text not null default 'coach' check (role in ('coach', 'admin')),
  court_id      text,
  status        text not null default 'invited' check (status in ('invited', 'active')),
  invited_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  unique (tournament_id, email)
);

create index if not exists tournament_staff_tournament_idx on tournament_staff(tournament_id);
create index if not exists tournament_staff_user_idx on tournament_staff(user_id);
create index if not exists tournament_staff_email_idx on tournament_staff(email);

alter table tournament_staff enable row level security;

-- Organizers manage staff for their own tournaments
create policy "staff_org_read" on tournament_staff
  for select using (
    exists (select 1 from tournaments t where t.id = tournament_staff.tournament_id and t.created_by = auth.uid())
  );

create policy "staff_org_insert" on tournament_staff
  for insert with check (
    exists (select 1 from tournaments t where t.id = tournament_staff.tournament_id and t.created_by = auth.uid())
  );

create policy "staff_org_update" on tournament_staff
  for update using (
    exists (select 1 from tournaments t where t.id = tournament_staff.tournament_id and t.created_by = auth.uid())
  );

create policy "staff_org_delete" on tournament_staff
  for delete using (
    exists (select 1 from tournaments t where t.id = tournament_staff.tournament_id and t.created_by = auth.uid())
  );

-- A staff member can read/claim their own invite row (to self-link on login)
create policy "staff_own_read" on tournament_staff
  for select using (auth.uid() = user_id or email = auth.email());

create policy "staff_own_claim" on tournament_staff
  for update using (email = auth.email() and user_id is null);

-- ─── Manual entries (organizer-added participants without an account) ─────────
alter table registrations add column if not exists manual_name  text;
alter table registrations add column if not exists manual_email text;
alter table registrations add column if not exists manual_mobile text;
alter table registrations alter column player_id drop not null;

create policy "registrations_org_insert" on registrations
  for insert with check (
    exists (
      select 1 from tournaments t
      where t.id = registrations.tournament_id
      and t.created_by = auth.uid()
    )
  );

-- ─── Bracket byes (walkovers) ──────────────────────────────────────────────
alter table matches alter column player2_name drop not null;

-- ─── Qatar ID: one stable identifier per person, reused across all their
--     registrations in a tournament instead of a random code per category ──
alter table player_profiles add column if not exists qid text;
create index if not exists player_profiles_qid_idx on player_profiles(qid);
alter table registrations add column if not exists manual_qid text;

-- ─── Family accounts: kid profiles managed by a parent, no login of their own ──
alter table player_profiles add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table player_profiles add column if not exists parent_id uuid references player_profiles(id) on delete cascade;
alter table player_profiles add column if not exists samanvayam_member boolean not null default false;
-- Samanvayam members can add family (spouse, son, daughter, ...) under their own account
alter table player_profiles add column if not exists relationship text;

-- Existing rows were created with id = the owning auth user's id
update player_profiles set auth_user_id = id where auth_user_id is null;

alter table player_profiles alter column id set default uuid_generate_v4();
alter table player_profiles drop constraint if exists player_profiles_id_fkey;

create unique index if not exists player_profiles_auth_user_id_idx on player_profiles(auth_user_id);
create index if not exists player_profiles_parent_id_idx on player_profiles(parent_id);

drop policy if exists "profiles_own_insert" on player_profiles;
drop policy if exists "profiles_own_update" on player_profiles;

-- A user manages their own profile row, and any kid rows they parent
create policy "profiles_own_insert" on player_profiles
  for insert with check (
    auth.uid() = auth_user_id
    or exists (
      select 1 from player_profiles parent
      where parent.id = player_profiles.parent_id
      and parent.auth_user_id = auth.uid()
    )
  );

create policy "profiles_own_update" on player_profiles
  for update using (
    auth.uid() = auth_user_id
    or exists (
      select 1 from player_profiles parent
      where parent.id = player_profiles.parent_id
      and parent.auth_user_id = auth.uid()
    )
  );

-- Registrations: a parent may act on behalf of their kids' profiles too
drop policy if exists "registrations_own_read" on registrations;
drop policy if exists "registrations_own_insert" on registrations;
drop policy if exists "registrations_own_withdraw" on registrations;

create policy "registrations_own_read" on registrations
  for select using (
    exists (
      select 1 from player_profiles p
      where p.id = registrations.player_id
      and (
        p.auth_user_id = auth.uid()
        or exists (select 1 from player_profiles parent where parent.id = p.parent_id and parent.auth_user_id = auth.uid())
      )
    )
  );

create policy "registrations_own_insert" on registrations
  for insert with check (
    exists (
      select 1 from player_profiles p
      where p.id = registrations.player_id
      and (
        p.auth_user_id = auth.uid()
        or exists (select 1 from player_profiles parent where parent.id = p.parent_id and parent.auth_user_id = auth.uid())
      )
    )
  );

create policy "registrations_own_withdraw" on registrations
  for update using (
    status = 'pending'
    and exists (
      select 1 from player_profiles p
      where p.id = registrations.player_id
      and (
        p.auth_user_id = auth.uid()
        or exists (select 1 from player_profiles parent where parent.id = p.parent_id and parent.auth_user_id = auth.uid())
      )
    )
  );
