-- Automatic doubles pairing. Each partner files their own form, typing the other's name.
-- When two entries in the same category name each other, they are linked automatically
-- (partner_id on both). Anything ambiguous stays unlinked and shows up on the "Unpaired doubles" tab.

create or replace function norm_name(t text) returns text
language sql immutable as $$
  select trim(regexp_replace(lower(coalesce(t,'')), '[^a-z0-9]+', ' ', 'g'))
$$;

-- names match if equal, or one is the start of the other ("mohit" vs "mohit katiyar")
create or replace function names_match(a text, b text) returns boolean
language sql immutable as $$
  select norm_name(a) <> '' and norm_name(b) <> ''
    and (norm_name(a) = norm_name(b)
      or norm_name(a) like norm_name(b) || ' %'
      or norm_name(b) like norm_name(a) || ' %')
$$;

create or replace function pair_registrations(a uuid, b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ra registrations%rowtype; rb registrations%rowtype; na text; nb text;
begin
  select * into ra from registrations where id = a;
  select * into rb from registrations where id = b;
  select full_name into na from player_profiles where id = ra.player_id;
  select full_name into nb from player_profiles where id = rb.player_id;
  update registrations set partner_id = rb.player_id, partner_name = nb where id = ra.id;
  update registrations set partner_id = ra.player_id, partner_name = na where id = rb.id;
end $$;
revoke all on function pair_registrations(uuid, uuid) from public, anon, authenticated;
grant execute on function pair_registrations(uuid, uuid) to service_role;

create or replace function auto_pair() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text; hits uuid[];
begin
  if new.category not like '%doubles%' or new.partner_id is not null
     or coalesce(new.partner_name,'') = '' or new.player_id is null then
    return new;
  end if;
  select full_name into me from player_profiles where id = new.player_id;
  select array_agg(r.id) into hits
  from registrations r
  join player_profiles p on p.id = r.player_id
  where r.tournament_id = new.tournament_id and r.category = new.category
    and r.id <> new.id and r.status <> 'withdrawn' and r.partner_id is null
    and r.player_id <> new.player_id
    and names_match(p.full_name, new.partner_name)
    and names_match(r.partner_name, me);
  if array_length(hits, 1) = 1 then
    perform pair_registrations(new.id, hits[1]);
  end if;
  return new;
end $$;

drop trigger if exists registrations_auto_pair on registrations;
create trigger registrations_auto_pair after insert or update of partner_name on registrations
  for each row execute function auto_pair();

-- link anything already sitting there
do $$ declare r record; begin
  for r in select id, player_id, tournament_id, category, partner_name from registrations
           where category like '%doubles%' and partner_id is null and coalesce(partner_name,'') <> ''
  loop
    update registrations set partner_name = partner_name where id = r.id;
  end loop;
end $$;

notify pgrst, 'reload schema';
