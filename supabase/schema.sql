-- ============================================================
-- Turnstiles — Supabase schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run
-- ============================================================

-- PROFILES (app data linked to the built-in auth.users table)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  first_name  text,
  last_name   text,
  avatar      text default '🎢',
  avatar_url  text, -- uploaded profile photo (Storage URL); takes precedence over `avatar` emoji when set
  bio         text,
  location    text,
  join_year   int default extract(year from now()),
  created_at  timestamptz default now()
);

-- CHECK-INS (one row per logged park visit)
create table public.checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  park        text not null,
  visit_date  date not null default current_date,
  miles       numeric default 0,
  score       numeric,
  foods       text[] default '{}',
  review      text,
  verified    boolean default false,   -- set true when geolocation confirms the park
  created_at  timestamptz default now()
);

-- FOOD REVIEWS
create table public.food_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_name   text not null,
  park        text not null,
  spot        text,
  score       numeric not null,
  review      text,
  photo_url   text,
  created_at  timestamptz default now()
);

-- PHOTOS (image_url points at a file in Supabase Storage)
create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  park        text not null,
  caption     text,
  image_url   text,
  created_at  timestamptz default now()
);

-- FOOD FAVORITES ("want to try" reminders, private to the user)
create table public.food_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_name   text not null,
  park        text not null,
  spot        text,
  created_at  timestamptz default now()
);

-- WAIT TIMES (posted board time vs. actual time, per ride)
create table public.wait_times (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  park         text not null,
  ride         text not null,
  posted_wait  int not null,
  actual_wait  int not null,
  created_at   timestamptz default now()
);

-- ============================================================
-- Auto-create a profile row whenever someone signs up.
-- Sign-up sends username/first_name/etc. as user metadata.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, first_name, last_name, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'avatar', '🎢')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security: everyone can READ community data,
-- but you can only WRITE your own rows.
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.checkins       enable row level security;
alter table public.food_reviews   enable row level security;
alter table public.photos         enable row level security;
alter table public.food_favorites enable row level security;
alter table public.wait_times     enable row level security;

-- profiles
create policy "profiles are public"  on public.profiles for select using (true);
create policy "insert own profile"   on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile"   on public.profiles for update using (auth.uid() = id);

-- checkins
create policy "checkins public read" on public.checkins for select using (true);
create policy "insert own checkin"   on public.checkins for insert with check (auth.uid() = user_id);
create policy "update own checkin"   on public.checkins for update using (auth.uid() = user_id);
create policy "delete own checkin"   on public.checkins for delete using (auth.uid() = user_id);

-- food_reviews
create policy "food public read"     on public.food_reviews for select using (true);
create policy "insert own food"      on public.food_reviews for insert with check (auth.uid() = user_id);
create policy "update own food"      on public.food_reviews for update using (auth.uid() = user_id);

-- photos
create policy "photos public read"   on public.photos for select using (true);
create policy "insert own photo"     on public.photos for insert with check (auth.uid() = user_id);
create policy "delete own photo"     on public.photos for delete using (auth.uid() = user_id);

-- food_favorites (private "want to try" list, not public like the rest)
create policy "favorites are own"    on public.food_favorites for select using (auth.uid() = user_id);
create policy "insert own favorite"  on public.food_favorites for insert with check (auth.uid() = user_id);
create policy "delete own favorite"  on public.food_favorites for delete using (auth.uid() = user_id);

-- wait_times
create policy "wait times public read" on public.wait_times for select using (true);
create policy "insert own wait time"   on public.wait_times for insert with check (auth.uid() = user_id);
create policy "delete own wait time"   on public.wait_times for delete using (auth.uid() = user_id);

-- ============================================================
-- MIGRATION — run this block instead if the tables above already
-- exist in your project (e.g. you ran this file before the food
-- review "spot" field and Edit action were added). Safe to re-run.
-- ============================================================
alter table public.food_reviews add column if not exists spot text;
alter table public.food_reviews add column if not exists photo_url text;

drop policy if exists "update own food" on public.food_reviews;
create policy "update own food" on public.food_reviews for update using (auth.uid() = user_id);

drop policy if exists "delete own food" on public.food_reviews;
create policy "delete own food" on public.food_reviews for delete using (auth.uid() = user_id);

-- ============================================================
-- MIGRATION — Supabase Storage bucket for photo uploads (adds a
-- real "photos" bucket so uploads no longer sit as base64 blobs in
-- the photos.image_url column). Safe to re-run. Existing base64
-- rows keep working; only new uploads use Storage.
-- Objects are stored as "<user_id>/<filename>" so the RLS policies
-- below can check the folder name against auth.uid().
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

drop policy if exists "photos storage public read" on storage.objects;
create policy "photos storage public read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos storage own insert" on storage.objects;
create policy "photos storage own insert" on storage.objects
  for insert with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "photos storage own delete" on storage.objects;
create policy "photos storage own delete" on storage.objects
  for delete using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- MIGRATION — "Want to Try" food favorites list. Safe to re-run.
-- ============================================================
create table if not exists public.food_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_name   text not null,
  park        text not null,
  spot        text,
  created_at  timestamptz default now()
);
alter table public.food_favorites enable row level security;

drop policy if exists "favorites are own" on public.food_favorites;
create policy "favorites are own" on public.food_favorites for select using (auth.uid() = user_id);

drop policy if exists "insert own favorite" on public.food_favorites;
create policy "insert own favorite" on public.food_favorites for insert with check (auth.uid() = user_id);

drop policy if exists "delete own favorite" on public.food_favorites;
create policy "delete own favorite" on public.food_favorites for delete using (auth.uid() = user_id);

-- ============================================================
-- MIGRATION — Wait Times (posted vs. actual, per ride). Safe to re-run.
-- ============================================================
create table if not exists public.wait_times (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  park         text not null,
  ride         text not null,
  posted_wait  int not null,
  actual_wait  int not null,
  created_at   timestamptz default now()
);
alter table public.wait_times enable row level security;

drop policy if exists "wait times public read" on public.wait_times;
create policy "wait times public read" on public.wait_times for select using (true);

drop policy if exists "insert own wait time" on public.wait_times;
create policy "insert own wait time" on public.wait_times for insert with check (auth.uid() = user_id);

drop policy if exists "delete own wait time" on public.wait_times;
create policy "delete own wait time" on public.wait_times for delete using (auth.uid() = user_id);

-- ============================================================
-- MIGRATION — uploaded profile photo, alongside the emoji avatar.
-- Safe to re-run. Reuses the existing "photos" Storage bucket/
-- policies (own-folder insert/delete) - no new bucket needed.
-- ============================================================
alter table public.profiles add column if not exists avatar_url text;

-- ============================================================
-- MIGRATION — fix bio/location never saving at signup.
-- handle_new_user() only ever wrote username/first_name/last_name/
-- avatar; the client tried to fill in bio/location with a follow-up
-- `update` right after signUp, but with email confirmation ON there's
-- no session yet at that point, so RLS silently drops the update (0
-- rows matched, no error). Folding bio/location into the same
-- trigger insert fixes it regardless of session state. Safe to re-run.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, first_name, last_name, avatar, bio, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'avatar', '🎢'),
    coalesce(new.raw_user_meta_data->>'bio', 'Theme park enthusiast.'),
    new.raw_user_meta_data->>'location'
  );
  return new;
end;
$$;

-- ============================================================
-- MIGRATION — Disney/Universal Annual Pass fields.
-- Which tier (if any) of each resort's AP the user holds, set at
-- signup and editable afterward. Folded into handle_new_user() for
-- the same reason bio/location were: with email confirmation ON
-- there's no session yet right after signUp(), so these travel as
-- signup metadata rather than a follow-up client update(). Safe to
-- re-run.
-- ============================================================
alter table public.profiles add column if not exists disney_pass text;
alter table public.profiles add column if not exists universal_pass text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, first_name, last_name, avatar, bio, location, disney_pass, universal_pass)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'avatar', '🎢'),
    coalesce(new.raw_user_meta_data->>'bio', 'Theme park enthusiast.'),
    new.raw_user_meta_data->>'location',
    new.raw_user_meta_data->>'disney_pass',
    new.raw_user_meta_data->>'universal_pass'
  );
  return new;
end;
$$;

-- ============================================================
-- MIGRATION — Thank You page: a public donor wall, plus a minimal
-- single-purpose admin flag so the site owner can manage it from
-- inside the app (Add Donor panel on the Thank You page) without a
-- full role/permission system. Safe to re-run.
--
-- After running this, make yourself an admin (one-time, run by hand):
--   update public.profiles set is_admin = true where username = 'YOUR_USERNAME';
-- ============================================================
alter table public.profiles add column if not exists is_admin boolean not null default false;

create table if not exists public.donors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  -- snapshot of the name to show, taken when the donor is added. Kept even for a
  -- linked account so the wall still shows a name if that account is ever deleted
  -- (user_id just goes null via the FK above; display_name survives).
  display_name text not null,
  created_at   timestamptz default now()
);
alter table public.donors enable row level security;

drop policy if exists "donors are public" on public.donors;
create policy "donors are public" on public.donors for select using (true);

drop policy if exists "admin insert donors" on public.donors;
create policy "admin insert donors" on public.donors for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

drop policy if exists "admin delete donors" on public.donors;
create policy "admin delete donors" on public.donors for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

-- ============================================================
-- MIGRATION — one-time welcome message on a new account's first
-- entry into the app. `welcomed` flips to true the moment enterApp()
-- shows the welcome modal and never shows again after that - see
-- enterApp() in supabase-data.js. Safe to re-run.
--
-- IMPORTANT: right after running this (and only this one time - do
-- NOT repeat this line on a future full-file re-run, or it will wipe
-- out the flag for anyone who's signed up since and is still waiting
-- to see the welcome message), backfill everyone who already has an
-- account so the message only fires for accounts created from here
-- on out:
--   update public.profiles set welcomed = true where welcomed = false;
-- ============================================================
alter table public.profiles add column if not exists welcomed boolean not null default false;

-- ============================================================
-- MIGRATION — EPCOT Festivals: a separate space for festival-specific
-- food booth reviews (Food & Wine, Flower & Garden, Festival of the
-- Arts, Holidays, etc.) so seasonal content doesn't clog the year-round
-- Food Scores page. "Current" festival = whichever row in `festivals`
-- has the newest created_at - everything older is automatically the
-- archive, no active/inactive flag to manage. Safe to re-run.
--
-- Starting a new festival is a one-line manual insert (the site owner
-- or Claude runs this by hand when a new one opens - infrequent enough
-- that a whole admin UI isn't worth it, same call made for `donors`):
--   insert into public.festivals (name) values ('EPCOT International Festival of the Arts 2027');
-- ============================================================
create table if not exists public.festivals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);
alter table public.festivals enable row level security;

drop policy if exists "festivals public read" on public.festivals;
create policy "festivals public read" on public.festivals for select using (true);
-- no write policy - festivals are only ever added by hand via the SQL above

create table if not exists public.festival_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  item_name   text not null, -- the food item being rated
  booth_name  text, -- where you got it, optional (mirrors food_reviews.spot)
  score       numeric not null,
  review      text,
  photo_url   text,
  created_at  timestamptz default now()
);
alter table public.festival_reviews enable row level security;

drop policy if exists "festival reviews public read" on public.festival_reviews;
create policy "festival reviews public read" on public.festival_reviews for select using (true);
drop policy if exists "insert own festival review" on public.festival_reviews;
create policy "insert own festival review" on public.festival_reviews for insert with check (auth.uid() = user_id);
drop policy if exists "update own festival review" on public.festival_reviews;
create policy "update own festival review" on public.festival_reviews for update using (auth.uid() = user_id);
drop policy if exists "delete own festival review" on public.festival_reviews;
create policy "delete own festival review" on public.festival_reviews for delete using (auth.uid() = user_id);

-- FESTIVAL FAVORITES ("want to try" reminders, private to the user - same as food_favorites)
create table if not exists public.festival_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  item_name   text not null,
  booth_name  text,
  created_at  timestamptz default now()
);
alter table public.festival_favorites enable row level security;

drop policy if exists "festival favorites are own" on public.festival_favorites;
create policy "festival favorites are own" on public.festival_favorites for select using (auth.uid() = user_id);
drop policy if exists "insert own festival favorite" on public.festival_favorites;
create policy "insert own festival favorite" on public.festival_favorites for insert with check (auth.uid() = user_id);
drop policy if exists "delete own festival favorite" on public.festival_favorites;
create policy "delete own festival favorite" on public.festival_favorites for delete using (auth.uid() = user_id);

-- seed the first festival so the page has something to show (safe to
-- re-run: only inserts if the table is completely empty)
insert into public.festivals (name)
select 'EPCOT International Food & Wine Festival 2026'
where not exists (select 1 from public.festivals);

-- ============================================================
-- MIGRATION — Epcot Festival reviews are about the FOOD, not the
-- booth (matches food_reviews: item_name = what you're rating,
-- booth_name = where you got it, optional). Run this if you already
-- ran the block above with the old "rate a booth" shape. Safe to
-- re-run.
-- ============================================================
alter table public.festival_reviews add column if not exists item_name text;
alter table public.festival_reviews alter column booth_name drop not null;
alter table public.festival_reviews drop column if exists location;

alter table public.festival_favorites add column if not exists item_name text;
alter table public.festival_favorites alter column booth_name drop not null;
alter table public.festival_favorites drop column if exists location;

-- ============================================================
-- MIGRATION — "Invite a Friend" from the profile dropdown.
-- Every invite sent is logged here, which is what api/invite.js
-- reads back to enforce its daily cap per user. Safe to re-run.
-- ============================================================
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;

-- No update or delete policy on purpose. A user who could clear their own
-- rows could reset the daily cap, so the log is append-only to everyone
-- except the service role.
drop policy if exists "invites are own" on public.invites;
create policy "invites are own" on public.invites for select using (auth.uid() = inviter_id);
drop policy if exists "insert own invite" on public.invites;
create policy "insert own invite" on public.invites for insert with check (auth.uid() = inviter_id);

create index if not exists invites_inviter_created_idx
  on public.invites (inviter_id, created_at desc);

-- ============================================================
-- MIGRATION — live wait times: the feed's stable ride id, so an
-- upstream rename does not split a ride's averages in two. Full
-- version with the one-time backfill is in
-- supabase/waittimes-ride-id.sql. Safe to re-run.
-- ============================================================
alter table public.wait_times add column if not exists ride_id text;

-- ============================================================
-- MIGRATION — Activity Feed opt-out. Defaults true so nothing
-- changes until somebody turns it off. Full version with the
-- reasoning is in supabase/activity-privacy.sql. Safe to re-run.
-- ============================================================
alter table public.profiles
  add column if not exists share_activity boolean not null default true;
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
-- ============================================================
-- Turnstiles — delete your own account, from inside the app
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- Apple's guideline 5.1.1(v) requires any app with account creation to
-- offer account deletion initiated IN the app. Pointing people at an
-- email address is explicitly not sufficient, and it is a common
-- rejection. This is also just the right thing to have.
--
-- The policy here is "keep the reviews, drop the identity": the scores
-- and wait times other people rely on survive as anonymous community
-- data, and everything that identifies a person goes.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Let three tables outlive their author.
--
-- Every user-owned table is `user_id uuid not null ... on delete
-- cascade`, so today deleting an account takes its food reviews and
-- wait times with it. For the three tables that hold shared community
-- data that is the wrong behaviour, so they become nullable and
-- `on delete set null` instead.
--
-- Everything NOT listed here keeps its cascade on purpose: profiles,
-- checkins, photos, favourites, invites, ride_logs and food_tallies are
-- personal history or exist only to rank a person, and should leave
-- with them.
--
-- The FK constraint names are looked up rather than assumed, since a
-- table created by an older migration may not use the default name.
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.conrelid in (
        'public.food_reviews'::regclass,
        'public.festival_reviews'::regclass,
        'public.wait_times'::regclass
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.food_reviews     alter column user_id drop not null;
alter table public.festival_reviews alter column user_id drop not null;
alter table public.wait_times       alter column user_id drop not null;

alter table public.food_reviews
  add constraint food_reviews_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.festival_reviews
  add constraint festival_reviews_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.wait_times
  add constraint wait_times_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- Note on the existing RLS: the insert/update/delete policies on these
-- tables all compare `auth.uid() = user_id`, and null never equals
-- anything, so an orphaned row becomes permanently immutable and cannot
-- be claimed by anyone. That is the behaviour we want, and it falls out
-- of the policies already there rather than needing new ones.


-- ------------------------------------------------------------
-- 2. The delete itself.
--
-- `authenticated` has no rights on auth.users, so this has to run with
-- elevated privileges. A security-definer function is used rather than
-- the service_role key in a serverless endpoint, deliberately:
--
--   * no new secret to store, rotate or leak
--   * no new public endpoint whose job is deleting users
--   * it takes no arguments and only ever deletes auth.uid(), so it is
--     incapable of deleting somebody else by construction
--
-- `search_path` is pinned empty and every name is schema-qualified, so
-- the function cannot be redirected by a caller's search_path.
-- ------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- The client removes the storage files before calling this, so any
  -- photo URL left on a surviving review would point at a 404. Clear
  -- them: the score stays, the picture does not.
  update public.food_reviews     set photo_url = null where user_id = uid;
  update public.festival_reviews set photo_url = null where user_id = uid;

  -- One delete does the rest. Cascades remove the personal tables; the
  -- three FKs changed above set null and leave the community data.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
-- ============================================================
-- Turnstiles — reporting, blocking and admin moderation
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- Apple's guideline 1.2 requires an app with user-generated content to
-- have four things. The published contact address already exists on the
-- About page. This adds the other three: a way to report content, a way
-- to block somebody, and a way for you to act on both.
-- ============================================================


-- ------------------------------------------------------------
-- REPORTS
--
-- `target_owner_id` is captured at report time rather than looked up
-- later, so a report still says who posted the thing even if the row is
-- deleted or its author closes their account.
-- ------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references auth.users(id) on delete cascade,
  target_type     text not null check (target_type in ('photo','food_review','festival_review','profile')),
  target_id       uuid not null,
  target_owner_id uuid,
  reason          text not null check (reason in ('offensive','harassment','spam','not_mine','other')),
  note            text,
  status          text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at      timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Anyone signed in can report. Nobody can read reports except an admin:
-- a report names its reporter, and a public reports table would make
-- reporting somebody a good way to get shouted at.
drop policy if exists "insert own report" on public.reports;
create policy "insert own report" on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports for select using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports for update using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);


-- ------------------------------------------------------------
-- BLOCKS
--
-- Strictly private: who you have blocked is nobody's business but
-- yours, including the person you blocked. Every policy is own-rows
-- only, so this table is invisible to everybody else.
-- ------------------------------------------------------------
create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks are own" on public.blocks;
create policy "blocks are own" on public.blocks for select using (auth.uid() = blocker_id);
drop policy if exists "insert own block" on public.blocks;
create policy "insert own block" on public.blocks for insert with check (auth.uid() = blocker_id);
drop policy if exists "delete own block" on public.blocks;
create policy "delete own block" on public.blocks for delete using (auth.uid() = blocker_id);


-- ------------------------------------------------------------
-- ADMIN CONTENT REMOVAL
--
-- Until now nobody could delete anybody else's row, which is correct
-- for normal use and useless for moderation: a report you cannot act on
-- is not a moderation system. These add admin-only delete alongside the
-- existing "delete own" policies, which stay exactly as they are.
--
-- Deliberately NOT added for profiles or checkins. Removing a person's
-- account is a different and heavier decision than taking down a photo,
-- and it stays a deliberate act in the SQL editor.
-- ------------------------------------------------------------
drop policy if exists "admins delete any photo" on public.photos;
create policy "admins delete any photo" on public.photos for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

drop policy if exists "admins delete any food review" on public.food_reviews;
create policy "admins delete any food review" on public.food_reviews for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

drop policy if exists "admins delete any festival review" on public.festival_reviews;
create policy "admins delete any festival review" on public.festival_reviews for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);
