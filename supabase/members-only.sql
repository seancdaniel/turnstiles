-- ============================================================
-- Turnstiles — members only
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- Until now every community table was readable by anyone holding the
-- publishable key, which ships in main.js for all to see. Hiding pages
-- from guests in the site did nothing about that: the data was one
-- REST call away. This switches each "public read" policy to signed in
-- users only.
--
-- Unchanged: private tables (favourites, blocks, invites, reports) keep
-- their own-rows policies, and every insert/update/delete policy is left
-- exactly as it was.
--
-- Not covered: photo FILES in the `photos` Storage bucket. The bucket is
-- public, so an image stays viewable by anyone who already has its exact
-- URL. Nobody can list or find them without being signed in, since the
-- rows that hold the URLs are now members only.
-- ============================================================

drop policy if exists "profiles are public" on public.profiles;
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles for select to authenticated using (true);

drop policy if exists "checkins public read" on public.checkins;
drop policy if exists "members read checkins" on public.checkins;
create policy "members read checkins" on public.checkins for select to authenticated using (true);

drop policy if exists "food public read" on public.food_reviews;
drop policy if exists "members read food reviews" on public.food_reviews;
create policy "members read food reviews" on public.food_reviews for select to authenticated using (true);

drop policy if exists "photos public read" on public.photos;
drop policy if exists "members read photos" on public.photos;
create policy "members read photos" on public.photos for select to authenticated using (true);

drop policy if exists "wait times public read" on public.wait_times;
drop policy if exists "members read wait times" on public.wait_times;
create policy "members read wait times" on public.wait_times for select to authenticated using (true);

drop policy if exists "donors are public" on public.donors;
drop policy if exists "members read donors" on public.donors;
create policy "members read donors" on public.donors for select to authenticated using (true);

drop policy if exists "festivals public read" on public.festivals;
drop policy if exists "members read festivals" on public.festivals;
create policy "members read festivals" on public.festivals for select to authenticated using (true);

drop policy if exists "festival reviews public read" on public.festival_reviews;
drop policy if exists "members read festival reviews" on public.festival_reviews;
create policy "members read festival reviews" on public.festival_reviews for select to authenticated using (true);

drop policy if exists "ride logs public read" on public.ride_logs;
drop policy if exists "members read ride logs" on public.ride_logs;
create policy "members read ride logs" on public.ride_logs for select to authenticated using (true);

drop policy if exists "food tallies public read" on public.food_tallies;
drop policy if exists "members read food tallies" on public.food_tallies;
create policy "members read food tallies" on public.food_tallies for select to authenticated using (true);


-- ------------------------------------------------------------
-- username_available(name)
--
-- Signup checks whether a username is taken before there is a session,
-- which a members only profiles table would now refuse. This answers
-- that one yes/no question and nothing else. Same exact match as the
-- unique constraint on profiles.username.
-- ------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select not exists (select 1 from public.profiles where username = p_username) $$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
