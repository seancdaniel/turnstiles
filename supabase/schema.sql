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
