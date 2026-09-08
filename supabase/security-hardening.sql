-- ============================================================
-- Turnstiles — security hardening
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- Fixes one real privilege-escalation hole and adds server-side
-- limits on values the app only checks in the browser today.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Stop a user promoting themselves to admin.  (the real one)
--
-- "update own profile" lets you update your own row, and RLS has no
-- way to say "except this column". Supabase grants table-level UPDATE
-- to `authenticated` by default, which covers every column, so any
-- signed-in person could send
--
--     PATCH /rest/v1/profiles?id=eq.<their own id>   {"is_admin": true}
--
-- and become an admin. That grants insert and delete on `donors`, so
-- the practical damage is defacing the Thank You page, but nobody
-- should be able to hand themselves a role at all.
--
-- The fix is column-level grants: drop the blanket UPDATE and hand
-- back only the columns the app actually writes. RLS still limits it
-- to your own row; this limits WHICH COLUMNS of that row.
-- `is_admin`, `id`, `join_year` and `created_at` become unwritable
-- from the client, and can only be set from the SQL editor.
-- ------------------------------------------------------------
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
  welcomed
) on public.profiles to authenticated;


-- ------------------------------------------------------------
-- 2. Server-side limits on free-text profile fields.
--
-- isValidUsername() and the form maxlengths run in the browser, which
-- means they are suggestions: anyone can POST straight to the REST
-- API and skip them. These constraints are the same rules enforced
-- where they cannot be bypassed.
--
-- Each is added only if it is missing, so re-running is harmless.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_shape') then
    alter table public.profiles
      add constraint profiles_username_shape
      check (username ~ '^[A-Za-z0-9_.]{3,20}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table public.profiles
      add constraint profiles_bio_len check (char_length(coalesce(bio, '')) <= 500);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_location_len') then
    alter table public.profiles
      add constraint profiles_location_len check (char_length(coalesce(location, '')) <= 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_name_len') then
    alter table public.profiles
      add constraint profiles_name_len
      check (char_length(coalesce(first_name, '')) <= 60
         and char_length(coalesce(last_name, ''))  <= 60);
  end if;
end $$;

-- NOTE: if this errors with "violates check constraint", an existing row
-- breaks one of these rules. Find it before deciding what to do:
--   select id, username from public.profiles where username !~ '^[A-Za-z0-9_.]{3,20}$';


-- ------------------------------------------------------------
-- 3. Sane bounds on the numbers that feed the leaderboards.
--
-- `miles` and `score` are only range-checked in the browser, so a
-- direct API insert could put 999999 miles on the board. This is
-- anti-nonsense, not anti-hacking, but it is one line each.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_miles_sane') then
    alter table public.checkins
      add constraint checkins_miles_sane check (miles is null or (miles >= 0 and miles <= 100));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'checkins_score_sane') then
    alter table public.checkins
      add constraint checkins_score_sane check (score is null or (score >= 0 and score <= 10));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'food_reviews_score_sane') then
    alter table public.food_reviews
      add constraint food_reviews_score_sane check (score >= 0 and score <= 10);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'festival_reviews_score_sane') then
    alter table public.festival_reviews
      add constraint festival_reviews_score_sane check (score >= 0 and score <= 10);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'wait_times_sane') then
    alter table public.wait_times
      add constraint wait_times_sane
      check (posted_wait between 0 and 600 and actual_wait between 0 and 600);
  end if;
end $$;
