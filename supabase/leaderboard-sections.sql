-- ============================================================
-- Turnstiles — Rides and Food leaderboards
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- Two tally tables behind the new Leaderboard submenu. One row per
-- lap and one row per snack, so counting is just counting and a
-- "this year" filter is a date comparison.
-- ============================================================


-- ------------------------------------------------------------
-- Park day in Orlando, not in UTC.
--
-- Postgres `current_date` is UTC, so a 9pm ride on a Saturday in
-- Florida would be stamped Sunday and fall outside that day's
-- check-in. Every date in these tables goes through this instead.
-- ------------------------------------------------------------
create or replace function public.park_today()
returns date
language sql
stable
set search_path = public
as $$ select (now() at time zone 'America/New_York')::date $$;


-- ------------------------------------------------------------
-- RIDE LOGS — one row per lap
-- ------------------------------------------------------------
create table if not exists public.ride_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  ride       text not null,
  ride_id    text,                                   -- themeparks.wiki id when known
  park       text not null,
  logged_on  date not null default public.park_today(),
  created_at timestamptz not null default now()
);

alter table public.ride_logs enable row level security;

drop policy if exists "ride logs public read" on public.ride_logs;
create policy "ride logs public read" on public.ride_logs for select using (true);

-- THE GATE, enforced here rather than only in the browser.
--
-- A ride can only be logged while you are checked in at that park today.
-- Doing this client-side alone would be decoration: anyone can POST
-- straight at the REST API. This is what makes the number mean "I was
-- actually there" instead of "I can tap a button".
drop policy if exists "insert own ride log" on public.ride_logs;
create policy "insert own ride log" on public.ride_logs for insert with check (
  auth.uid() = user_id
  and logged_on = public.park_today()
  and exists (
    select 1 from public.checkins c
    where c.user_id = auth.uid()
      and c.park = ride_logs.park
      and c.visit_date = public.park_today()
  )
);

-- deleting your own is how a mis-tap gets undone. No update policy:
-- there is nothing in a row worth editing after the fact.
drop policy if exists "delete own ride log" on public.ride_logs;
create policy "delete own ride log" on public.ride_logs for delete using (auth.uid() = user_id);

create index if not exists ride_logs_ride_idx on public.ride_logs (ride);
create index if not exists ride_logs_user_idx on public.ride_logs (user_id, logged_on desc);


-- ------------------------------------------------------------
-- FOOD TALLIES — one row per snack
--
-- Deliberately NOT tied to a restaurant. A hot dog is a hot dog
-- wherever you bought it, and per-location counts would scatter the
-- data across hundreds of near-empty boards. Rating a specific item
-- at a specific place stays in `food_reviews`, which is a different
-- question with a different answer.
-- ------------------------------------------------------------
create table if not exists public.food_tallies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  food_key   text not null,                          -- matches FOOD_CATEGORIES in supabase-tallies.js
  park       text,                                   -- colour only, never grouped on
  logged_on  date not null default public.park_today(),
  created_at timestamptz not null default now()
);

alter table public.food_tallies enable row level security;

drop policy if exists "food tallies public read" on public.food_tallies;
create policy "food tallies public read" on public.food_tallies for select using (true);

-- Same gate, loosened by one degree: food needs an active check-in
-- today, but at ANY park, because a churro is not tied to a park the
-- way an attraction is.
drop policy if exists "insert own food tally" on public.food_tallies;
create policy "insert own food tally" on public.food_tallies for insert with check (
  auth.uid() = user_id
  and logged_on = public.park_today()
  and exists (
    select 1 from public.checkins c
    where c.user_id = auth.uid()
      and c.visit_date = public.park_today()
  )
);

drop policy if exists "delete own food tally" on public.food_tallies;
create policy "delete own food tally" on public.food_tallies for delete using (auth.uid() = user_id);

create index if not exists food_tallies_key_idx on public.food_tallies (food_key);
create index if not exists food_tallies_user_idx on public.food_tallies (user_id, logged_on desc);
