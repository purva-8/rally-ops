-- Tracks payment of the partner's half separately, so a doubles pair can be paid by two different families
alter table registrations add column if not exists partner_paid boolean not null default false;
