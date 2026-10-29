-- Cash taken at the desk, one row per payment, and entries taken off a bill at the desk. Only the server (service
-- role) reads and writes these: row-level security is on with no policies, so the browser cannot touch them.
-- Run once in Supabase → SQL editor. Safe to run again.

create table if not exists bill_payments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  -- the family head's profile id, or name:<name> for someone not on the platform (see lib/billCharges)
  head_id text not null,
  head_name text,
  received numeric(10, 2) not null default 0 check (received >= 0),
  change_given numeric(10, 2) not null default 0 check (change_given >= 0),
  -- what the bill is credited: received minus change (negative when money is given back)
  amount numeric(10, 2) not null,
  note text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index if not exists bill_payments_head on bill_payments (tournament_id, head_id);
alter table bill_payments enable row level security;

create table if not exists bill_removals (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  reg_ids uuid[] not null,
  label text,
  head_id text,
  removed_by uuid,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index if not exists bill_removals_tournament on bill_removals (tournament_id);
alter table bill_removals enable row level security;

-- Matches made on the spot (Score desk → Match maker) carry their own name: "Round 1", "Round 2", "Final"
alter table matches add column if not exists label text;
