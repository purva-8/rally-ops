-- When someone picks an existing entry as their partner (partner_id set), also link the entry that named them.
create or replace function auto_pair() returns trigger
language plpgsql security definer set search_path = public as $$
declare me text; hits uuid[]; other uuid;
begin
  if new.category not like '%doubles%' or new.player_id is null then return new; end if;

  if new.partner_id is not null then
    select r.id into other from registrations r
    where r.tournament_id = new.tournament_id and r.category = new.category
      and r.player_id = new.partner_id and r.partner_id is null and r.status <> 'withdrawn' and r.id <> new.id
    limit 1;
    if other is not null then
      update registrations set partner_id = new.player_id,
        partner_name = (select full_name from player_profiles where id = new.player_id)
      where id = other;
    end if;
    return new;
  end if;

  if coalesce(new.partner_name,'') = '' then return new; end if;
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
create trigger registrations_auto_pair after insert or update of partner_name, partner_id on registrations
  for each row execute function auto_pair();

notify pgrst, 'reload schema';
