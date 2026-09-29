-- ============================================================
-- Turnstiles — hide your full name
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- A member can choose to show only their username. For that to mean
-- anything, other members must not be able to read the name at all,
-- not just avoid seeing it on screen: until now first_name and
-- last_name came down with every profile, to every signed in member.
--
--   1. `show_full_name` on the profile, true by default so nothing
--      changes for anyone until they turn it off.
--   2. first_name and last_name are no longer readable from the
--      profiles table by anyone using the site. Every other column
--      stays readable to members, exactly as before.
--   3. `profile_names` hands out a name only when its owner shows it,
--      and always your own.
--
-- GOTCHA for later: column level SELECT grants mean a NEW column on
-- profiles is invisible to the site until it is added to the grant
-- below. The site asks for named columns (PROFILE_COLS in
-- supabase-auth.js), so add it there too.
-- ============================================================

-- share_activity comes from activity-privacy.sql, which was never run
-- on the live project (found 2026-09-29 when this file failed on it), so
-- it is created here too. Harmless if it already exists.
alter table public.profiles
  add column if not exists share_activity boolean not null default true;
alter table public.profiles
  add column if not exists show_full_name boolean not null default true;

-- The admin loophole from security-hardening.sql section 1, which had also
-- never run (it grants share_activity too, so it failed the same way).
-- Only these columns are writable from the site; is_admin, id, join_year
-- and created_at can only be changed in the SQL editor.
revoke update on public.profiles from anon, authenticated;
grant update (
  first_name,
  last_name,
  username,
  avatar,
  avatar_url,
  bio,
  location,
  disney_pass,
  universal_pass,
  share_activity,
  welcomed,
  show_full_name
) on public.profiles to authenticated;

revoke select on public.profiles from anon, authenticated;
grant select (
  id,
  username,
  avatar,
  avatar_url,
  bio,
  location,
  join_year,
  created_at,
  disney_pass,
  universal_pass,
  is_admin,
  welcomed,
  share_activity,
  show_full_name
) on public.profiles to authenticated;


-- Runs with its owner's rights (the default for a view), so it can read
-- the names the caller cannot, and the WHERE clause decides which to
-- hand back. Signed in only.
create or replace view public.profile_names as
  select id, first_name, last_name
    from public.profiles
   where auth.uid() is not null
     and (show_full_name or id = auth.uid());

revoke all on public.profile_names from public, anon;
grant select on public.profile_names to authenticated;
