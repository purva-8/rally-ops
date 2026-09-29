-- ─── Backend hardening: nothing gets lost, nothing gets double-booked ───────────
-- Safe to run more than once.

-- 1. Audit log: every insert, update and delete on the important tables is recorded
--    with who did it, when, and the full before/after row, so anything removed or
--    changed can be found and restored.
create table if not exists audit_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  actor         uuid,
  action        text not null,            -- INSERT | UPDATE | DELETE
  table_name    text not null,
  row_id        text,
  tournament_id uuid,
  old_row       jsonb,
  new_row       jsonb
);

create index if not exists audit_log_tournament_idx on audit_log(tournament_id, at desc);
create index if not exists audit_log_row_idx on audit_log(table_name, row_id);

create or replace function log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  tid uuid;
begin
  if tg_table_name = 'tournaments' then
    tid := (r->>'id')::uuid;
  elsif r ? 'tournament_id' then
    tid := nullif(r->>'tournament_id', '')::uuid;
  elsif tg_table_name = 'match_sets' then
    select m.tournament_id into tid from matches m where m.id = (r->>'match_id')::uuid;
  end if;

  insert into audit_log(actor, action, table_name, row_id, tournament_id, old_row, new_row)
  values (
    auth.uid(), tg_op, tg_table_name, r->>'id', tid,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['registrations','matches','match_sets','player_profiles','tournaments','tournament_staff']
  loop
    execute format('drop trigger if exists %I on %I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function log_change()', 'audit_' || t, t);
  end loop;
end $$;

alter table audit_log enable row level security;
drop policy if exists "audit_organizer_read" on audit_log;
create policy "audit_organizer_read" on audit_log
  for select using (
    exists (select 1 from tournaments t where t.id = audit_log.tournament_id and t.created_by = auth.uid())
  );

-- 2. One live registration per person per category per tournament (withdrawn entries don't count)
create unique index if not exists registrations_one_per_category
  on registrations(tournament_id, player_id, category)
  where player_id is not null and status <> 'withdrawn';

-- 3. Server-side registration guard: the browser can't bypass the rules
create or replace function guard_registration() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
  taken int;
begin
  select * into t from tournaments where id = new.tournament_id;
  if not found then raise exception 'Tournament not found'; end if;

  -- The organizer can always add entries by hand
  if auth.uid() is not null and t.created_by = auth.uid() then return new; end if;

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

drop trigger if exists registrations_guard on registrations;
create trigger registrations_guard before insert on registrations
  for each row execute function guard_registration();

-- 4. Indexes for 200-300 registrants, exports and admin screens
create index if not exists registrations_tournament_status_idx on registrations(tournament_id, status);
create index if not exists registrations_player_idx on registrations(player_id);
create index if not exists player_profiles_parent_idx on player_profiles(parent_id);

notify pgrst, 'reload schema';
