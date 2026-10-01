-- Server-side eligibility: the database itself refuses an entry the rules do not allow
-- (wrong gender or age for the category, or a partner who cannot be in it).
-- The category list below is generated from lib/categories.ts. If categories change there, regenerate this block.

-- The date on which age is counted. Leave empty to use the event day; set it to change the rule for the whole event, e.g.
--   update tournaments set age_as_of = '2026-12-31' where name ilike '%samanvay%';
alter table tournaments add column if not exists age_as_of date;

create table if not exists category_rules (
  id text primary key,
  genders text[],
  min_age int,
  max_age int,
  doubles boolean not null default false,
  mixed boolean not null default false,
  spouse boolean not null default false
);

insert into category_rules (id, genders, min_age, max_age, doubles, mixed, spouse) values
('male_singles', array['male'], null, null, false, false, false),
  ('female_singles', array['female'], null, null, false, false, false),
  ('male_doubles', array['male'], null, null, true, false, false),
  ('female_doubles', array['female'], null, null, true, false, false),
  ('spouse_doubles', null, null, null, true, false, true),
  ('mixed_doubles', null, null, null, true, true, false),
  ('boys_u13', array['male'], null, 13, false, false, false),
  ('boys_u15', array['male'], null, 15, false, false, false),
  ('boys_u18', array['male'], null, 18, false, false, false),
  ('girls_u13', array['female'], null, 13, false, false, false),
  ('girls_u15', array['female'], null, 15, false, false, false),
  ('girls_u18', array['female'], null, 18, false, false, false),
  ('female_singles_18plus', array['female'], 18, null, false, false, false),
  ('female_singles_kids', array['female'], 10, 14, false, false, false),
  ('female_singles_youth', array['female'], 15, 18, false, false, false),
  ('male_singles_18plus', array['male'], 18, null, false, false, false),
  ('male_singles_kids', array['male'], 10, 14, false, false, false),
  ('male_singles_youth', array['male'], 15, 18, false, false, false),
  ('male_doubles_18plus', array['male'], 18, null, true, false, false),
  ('mixed_doubles_kids', null, 10, 14, true, true, false),
  ('mixed_doubles_youth', null, 15, 18, true, true, false),
  ('mixed_doubles_open', null, 18, null, true, true, false),
  ('spouse_doubles_open', null, 18, null, true, false, true),
  ('female_doubles_open', array['female'], 18, null, true, false, false),
  ('singles_u10', null, 7, 10, false, false, false),
  ('doubles_u10', null, 7, 10, true, false, false)
on conflict (id) do update set genders = excluded.genders, min_age = excluded.min_age, max_age = excluded.max_age,
  doubles = excluded.doubles, mixed = excluded.mixed, spouse = excluded.spouse;

alter table category_rules enable row level security;
drop policy if exists "category_rules_read" on category_rules;
create policy "category_rules_read" on category_rules for select using (true);

create or replace function check_registration_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r category_rules%rowtype;
  t tournaments%rowtype;
  me player_profiles%rowtype;
  pt player_profiles%rowtype;
  asof date;
  my_age int;
  pt_age int;
  same_home boolean;
begin
  -- server-side work (service role, developer tools) is trusted; organizers add manual entries without a profile
  if auth.uid() is null or new.player_id is null then return new; end if;
  select * into r from category_rules where id = new.category;
  if not found then return new; end if;
  select * into t from tournaments where id = new.tournament_id;
  asof := coalesce(t.age_as_of, t.event_date, current_date);
  select * into me from player_profiles where id = new.player_id;

  if r.genders is not null and (me.gender is null or not (me.gender = any(r.genders))) then
    raise exception 'This category is not open to this player (gender).';
  end if;
  if me.dob is not null then
    my_age := date_part('year', age(asof, me.dob));
    if r.min_age is not null and my_age < r.min_age then raise exception 'This player is too young for this category (minimum age %).', r.min_age; end if;
    if r.max_age is not null and my_age > r.max_age then raise exception 'This player is too old for this category (maximum age %).', r.max_age; end if;
  end if;

  if r.doubles and new.partner_id is not null then
    select * into pt from player_profiles where id = new.partner_id;
    if r.genders is not null and pt.gender is not null and not (pt.gender = any(r.genders)) then
      raise exception 'The partner is not eligible for this category (gender).';
    end if;
    if pt.dob is not null then
      pt_age := date_part('year', age(asof, pt.dob));
      if r.min_age is not null and pt_age < r.min_age then raise exception 'The partner is too young for this category (minimum age %).', r.min_age; end if;
      if r.max_age is not null and pt_age > r.max_age then raise exception 'The partner is too old for this category (maximum age %).', r.max_age; end if;
    end if;
    if r.mixed and me.gender is not null and pt.gender is not null and me.gender = pt.gender then
      raise exception 'Mixed doubles needs one man and one woman.';
    end if;
    if r.spouse then
      same_home := coalesce(me.parent_id, me.id) = coalesce(pt.parent_id, pt.id);
      if same_home and not ((me.parent_id is null and pt.relationship = 'spouse') or (pt.parent_id is null and me.relationship = 'spouse')) then
        raise exception 'Spouse doubles is for husband and wife.';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists registrations_rules on registrations;
create trigger registrations_rules before insert or update of category, player_id, partner_id on registrations
  for each row execute function check_registration_rules();


-- Automatic pairing must never block someone's own registration: if a link would break a rule, it is simply skipped
-- (the entry then shows on the Pairs tab for an organizer to look at).
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
      begin
        update registrations set partner_id = new.player_id,
          partner_name = (select full_name from player_profiles where id = new.player_id)
        where id = other;
      exception when others then null;
      end;
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
    begin
      perform pair_registrations(new.id, hits[1]);
    exception when others then null;
    end;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
