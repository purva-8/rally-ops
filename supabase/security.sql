-- ─── Security, traceability and recovery ────────────────────────────────────────
-- Run once. Safe to run again. To undo the profile-privacy change see the ROLLBACK note at the end.

-- Optional Samanvayam membership number
alter table player_profiles add column if not exists samanvayam_id text;

-- ── 1. Profiles were readable by everyone (using true). Limit them to: yourself, your family,
--       and the organizers or staff of tournaments those people are entered in.
--       Helper functions are SECURITY DEFINER so the rules never loop back into themselves.
create or replace function my_account_profile_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from player_profiles where auth_user_id = auth.uid()
$$;

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
          where s.tournament_id = t.id and s.user_id = auth.uid() and s.status = 'active'
        )
      )
  )
$$;

drop policy if exists "profiles_public_read" on player_profiles;
drop policy if exists "profiles_read_scoped" on player_profiles;
create policy "profiles_read_scoped" on player_profiles
  for select using (
    auth_user_id = auth.uid()
    or parent_id in (select my_account_profile_ids())
    or can_manage_profile(id)
  );

-- ── 2. Undo from history: puts a deleted row back, or reverts an edit, using the audit log.
--       Call it with the id of the audit_log row (Developer section, or ask Claude).
create or replace function restore_from_audit(p_audit_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  a audit_log%rowtype;
  cols text;
begin
  select * into a from audit_log where id = p_audit_id;
  if not found then return 'No such audit entry'; end if;

  if a.action = 'DELETE' then
    execute format('insert into %I select * from jsonb_populate_record(null::%I, $1) on conflict do nothing', a.table_name, a.table_name)
      using a.old_row;
    return 'Restored the deleted row';
  elsif a.action in ('UPDATE','DEV_EDIT') then
    select string_agg(format('%I = r.%I', column_name, column_name), ', ') into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = a.table_name and column_name <> 'id';
    execute format('update %I t set %s from jsonb_populate_record(null::%I, $1) r where t.id = r.id', a.table_name, cols, a.table_name)
      using a.old_row;
    return 'Reverted to the previous version';
  end if;
  return 'Nothing to restore for this kind of entry';
end $$;

revoke all on function restore_from_audit(bigint) from public, anon, authenticated;
grant execute on function restore_from_audit(bigint) to service_role;

notify pgrst, 'reload schema';

-- ROLLBACK (only if an admin screen stops loading player details after this runs):
--   drop policy if exists "profiles_read_scoped" on player_profiles;
--   create policy "profiles_public_read" on player_profiles for select using (true);
