-- Every change to a match (score saved, result undone, match made or taken back, players changed, draw deleted
-- or restored, history restored) with the match and its scores before and after, so anything can be put back.
-- Append only; only the server (service role) reads and writes it. Run once in Supabase → SQL editor. Safe to rerun.

create table if not exists match_log (
  id bigserial primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id uuid,
  category text,
  action text not null,
  summary text,
  -- { match: <row>, sets: [<row>] } as it was before and after; null when there was no match (made / deleted)
  before jsonb,
  after jsonb,
  by_user uuid,
  created_at timestamptz not null default now()
);
create index if not exists match_log_recent on match_log (tournament_id, created_at desc);
alter table match_log enable row level security;
