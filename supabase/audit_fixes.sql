-- ─── Pre-tournament audit fixes ─────────────────────────────────────────────────
-- Safe to run more than once. Adds one column and one index, drops one policy, narrows one function.
-- Nothing is deleted. Rollback notes are at the end.

-- 1. Anyone could make themselves co-organizer of any event: staff_own_claim let a user re-point an unclaimed
--    invite row carrying their own email (tournament_id, role) and then claim it. Claiming already goes through
--    /api/tournament/staff/claim with the service role, so users never need to update staff rows themselves.
drop policy if exists "staff_own_claim" on tournament_staff;

-- 2. Bracket slot inside a round. Winners of slots 2k and 2k+1 meet in the next round, so the order must be stored.
alter table matches add column if not exists position int;
-- Two devices finishing the last match of a round at once can't both create the next round
create unique index if not exists matches_bracket_slot
  on matches(tournament_id, category, round, position) where position is not null;

-- 3. Coaches only need names (already on the match rows); player details stay with the organizers
create or replace function can_manage_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from registrations r
    join tournaments t on t.id = r.tournament_id
    left join player_profiles k on k.id = r.player_id
    where (r.player_id = pid or r.partner_id = pid or k.parent_id = pid)
      and (
        t.created_by = auth.uid()
        or exists (
          select 1 from tournament_staff s
          where s.tournament_id = t.id and s.user_id = auth.uid() and s.status = 'active' and s.role = 'admin'
        )
      )
  )
$$;

-- 4. Co-organizers add entries by hand like the creator (the guard only let the creator past the open/closed checks)
create or replace function guard_registration() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
  taken int;
begin
  select * into t from tournaments where id = new.tournament_id;
  if not found then raise exception 'Tournament not found'; end if;

  -- The organizer and co-organizers can always add entries by hand
  if auth.uid() is not null and (t.created_by = auth.uid() or is_co_organizer(t.id)) then return new; end if;

  if t.status <> 'open' then
    raise exception 'Registration is not open for this tournament';
  end if;
  if t.registration_close_at is not null and now() > t.registration_close_at then
    raise exception 'Registration has closed';
  end if;
  if t.categories is not null and not (new.category = any(t.categories)) then
    raise exception 'This category is not offered in this tournament';
  end if;
  if t.max_participants is not null then
    select count(distinct player_id) into taken
    from registrations
    where tournament_id = new.tournament_id and status in ('pending','approved')
      and player_id is distinct from new.player_id;
    if taken >= t.max_participants then
      raise exception 'This tournament is full';
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

-- ROLLBACK
--   1. create policy "staff_own_claim" on tournament_staff for update using (email = auth.email() and user_id is null);
--      (not recommended: it reopens the hole)
--   2. drop index if exists matches_bracket_slot; alter table matches drop column if exists position;
--   3. re-run the can_manage_profile block from security.sql
--   4. re-run the guard_registration block from hardening.sql
