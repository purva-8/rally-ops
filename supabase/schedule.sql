-- Day-of schedule: which day and 2-hour block each category plays in (admin Schedule tab).
-- Safe to run twice. Deletes nothing.
alter table tournaments add column if not exists schedule jsonb;

-- Undo: alter table tournaments drop column if exists schedule;
