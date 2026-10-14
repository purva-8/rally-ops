-- Lets a doubles pair be paid by two different families: the partner's half is tracked on its own
alter table registrations add column if not exists partner_paid boolean not null default false;
