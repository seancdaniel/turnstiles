-- ============================================================
-- Turnstiles — mark a check-in as completed
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run. (Run on the live project 2026-09-29.)
--
-- The home page's "Complete Check-In" reminder used to show your latest
-- check-in until it had miles, so finishing without miles never cleared
-- it. Both buttons in Complete Check-In now set this flag instead.
-- Rows that already have miles count as completed.
-- ============================================================

alter table public.checkins
  add column if not exists completed boolean not null default false;

update public.checkins set completed = true where miles > 0 and not completed;
