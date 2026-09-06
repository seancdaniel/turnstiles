-- ============================================================
-- Turnstiles — Activity Feed opt-out
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- One flag on the profile, defaulting to true so nothing changes for
-- anyone until they turn it off themselves. When it is false the app
-- leaves that person out of the community Activity Feed and hides the
-- Recent Visits list on their public profile. Their totals, tiers and
-- leaderboard position are deliberately unaffected.
--
-- Worth being clear about what this is: the app filters on it, so it
-- hides those check-ins from people using the site. The `checkins` table
-- itself stays publicly readable, because the leaderboards, tiers and
-- profile stats are all computed from it in the browser. Enforcing this
-- in the database would mean an RLS policy that hides the rows outright,
-- which would also remove that person from every leaderboard.
-- ============================================================

alter table public.profiles
  add column if not exists share_activity boolean not null default true;
