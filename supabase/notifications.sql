-- ─── Automatic emails: decisions, fixtures, results ─────────────────────────────
-- Safe to run more than once.

alter table registrations add column if not exists review_comment text;
alter table registrations add column if not exists decided_at timestamptz;
alter table registrations add column if not exists decision_notified_at timestamptz;

alter table matches add column if not exists fixture_notified_at timestamptz;
alter table matches add column if not exists result_notified_at timestamptz;

-- Every email we try to send is recorded, so a missing email can always be traced
create table if not exists email_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  kind          text not null,      -- registration | decision | fixture | final | result
  to_email      text not null,
  subject       text not null,
  tournament_id uuid,
  status        text not null,      -- sent | failed | skipped
  error         text
);
create index if not exists email_log_tournament_idx on email_log(tournament_id, at desc);
alter table email_log enable row level security;
drop policy if exists "email_log_organizer_read" on email_log;
create policy "email_log_organizer_read" on email_log
  for select using (
    exists (select 1 from tournaments t where t.id = email_log.tournament_id and t.created_by = auth.uid())
  );

-- A new decision (approve, reject, revoke) queues a fresh decision email
create or replace function registrations_track_decision() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    new.decided_at := now();
    new.decision_notified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists registrations_decision on registrations;
create trigger registrations_decision before update on registrations
  for each row execute function registrations_track_decision();

-- A finished match (or a corrected result) queues a result email; a new time, court
-- or opponent queues a fresh fixture email
create or replace function matches_track_notifications() returns trigger
language plpgsql as $$
begin
  if new.status = 'completed'
     and (old.status is distinct from 'completed' or new.winner_id is distinct from old.winner_id) then
    new.result_notified_at := null;
  end if;
  if new.scheduled_at is distinct from old.scheduled_at
     or new.court_id is distinct from old.court_id
     or new.player1_id is distinct from old.player1_id
     or new.player2_id is distinct from old.player2_id then
    new.fixture_notified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists matches_notify on matches;
create trigger matches_notify before update on matches
  for each row execute function matches_track_notifications();

notify pgrst, 'reload schema';

-- Withdrawing marks an entry as withdrawn instead of deleting it. The old policy only allowed
-- rows to stay 'pending', so it blocked that change.
drop policy if exists "registrations_own_withdraw" on registrations;
create policy "registrations_own_withdraw" on registrations
  for update
  using (
    status = 'pending'
    and exists (
      select 1 from player_profiles p
      where p.id = registrations.player_id
      and (p.auth_user_id = auth.uid()
        or exists (select 1 from player_profiles parent where parent.id = p.parent_id and parent.auth_user_id = auth.uid()))
    )
  )
  with check (
    status = 'withdrawn'
    and exists (
      select 1 from player_profiles p
      where p.id = registrations.player_id
      and (p.auth_user_id = auth.uid()
        or exists (select 1 from player_profiles parent where parent.id = p.parent_id and parent.auth_user_id = auth.uid()))
    )
  );
