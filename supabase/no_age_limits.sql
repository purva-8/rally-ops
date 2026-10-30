-- No age limits (organizers' decision, 30/10): anyone can be entered in any age band. The database keeps
-- refusing only the wrong gender for a category and a parent/child pair in Spouse doubles.
-- Replaces check_registration_rules from eligibility.sql. Run once in Supabase → SQL editor. Safe to rerun.

create or replace function check_registration_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r category_rules%rowtype;
  me player_profiles%rowtype;
  pt player_profiles%rowtype;
  same_home boolean;
begin
  -- server-side work (service role, developer tools) is trusted; organizers add manual entries without a profile
  if auth.uid() is null or new.player_id is null then return new; end if;
  select * into r from category_rules where id = new.category;
  if not found then return new; end if;
  select * into me from player_profiles where id = new.player_id;

  if r.genders is not null and (me.gender is null or not (me.gender = any(r.genders))) then
    raise exception 'This category is not open to this player (gender).';
  end if;

  if r.doubles and new.partner_id is not null then
    select * into pt from player_profiles where id = new.partner_id;
    if r.genders is not null and pt.gender is not null and not (pt.gender = any(r.genders)) then
      raise exception 'The partner is not eligible for this category (gender).';
    end if;
    if r.spouse then
      same_home := coalesce(me.parent_id, me.id) = coalesce(pt.parent_id, pt.id);
      if same_home and (me.relationship in ('son','daughter') or pt.relationship in ('son','daughter')) then
        raise exception 'Spouse doubles is for husband and wife.';
      end if;
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
