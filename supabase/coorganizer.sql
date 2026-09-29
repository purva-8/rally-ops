-- Co-organizer: an admin staff member (role 'admin', status 'active') can run an event like its creator.
-- These policies are added next to the existing ones (Postgres ORs them), nothing is removed.

create or replace function is_co_organizer(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tournament_staff s
    where s.tournament_id = tid and s.user_id = auth.uid() and s.role = 'admin' and s.status = 'active'
  )
$$;

drop policy if exists "registrations_coorg_read"   on registrations;
drop policy if exists "registrations_coorg_update" on registrations;
drop policy if exists "registrations_coorg_insert" on registrations;
create policy "registrations_coorg_read"   on registrations for select using (is_co_organizer(tournament_id));
create policy "registrations_coorg_update" on registrations for update using (is_co_organizer(tournament_id));
create policy "registrations_coorg_insert" on registrations for insert with check (is_co_organizer(tournament_id));

drop policy if exists "matches_coorg_insert" on matches;
drop policy if exists "matches_coorg_update" on matches;
create policy "matches_coorg_insert" on matches for insert with check (is_co_organizer(tournament_id));
create policy "matches_coorg_update" on matches for update using (is_co_organizer(tournament_id));

drop policy if exists "match_sets_coorg_insert" on match_sets;
drop policy if exists "match_sets_coorg_update" on match_sets;
create policy "match_sets_coorg_insert" on match_sets for insert with check (
  exists (select 1 from matches m where m.id = match_sets.match_id and is_co_organizer(m.tournament_id)));
create policy "match_sets_coorg_update" on match_sets for update using (
  exists (select 1 from matches m where m.id = match_sets.match_id and is_co_organizer(m.tournament_id)));

drop policy if exists "audit_coorg_read" on audit_log;
drop policy if exists "email_log_coorg_read" on email_log;
create policy "audit_coorg_read" on audit_log for select using (is_co_organizer(tournament_id));
create policy "email_log_coorg_read" on email_log for select using (is_co_organizer(tournament_id));

-- Invite Mohit as a co-organizer of the newest event (he accepts by opening the invite link while signed in)
insert into tournament_staff (tournament_id, email, name, role)
select id, 'mohit82online@gmail.com', 'Mohit Katiyar', 'admin' from tournaments order by created_at desc limit 1
on conflict (tournament_id, email) do update set role = 'admin';

notify pgrst, 'reload schema';
