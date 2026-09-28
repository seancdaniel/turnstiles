-- ============================================================
-- Turnstiles — Community Photos rework
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run. Run members-only.sql first.
--
-- Community Photos used to fill up by accident: every check-in photo,
-- Complete Check-In photo, food review photo and festival review photo
-- was copied into `photos` automatically. From now on `photos` holds
-- only what somebody chose to share there.
--
--   * Check-in photos get their own private table, so a photo someone
--     does not share still has a home. Only the owner can read it.
--   * Food and festival review photos never go to the gallery. They
--     already live on the review itself (photo_url), so the gallery
--     copies are removed below and nothing is lost.
--   * Likes on gallery photos.
--   * Storage listing is tightened to your own folder.
-- ============================================================


-- ------------------------------------------------------------
-- CHECK-IN PHOTOS (private to the owner)
--
-- Several per check-in are allowed: one when checking in, more when
-- completing the visit later. Sharing one to the gallery inserts a
-- `photos` row with the same image_url; this row stays, so unsharing
-- never loses the photo.
-- ------------------------------------------------------------
create table if not exists public.checkin_photos (
  id          uuid primary key default gen_random_uuid(),
  checkin_id  uuid not null references public.checkins(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  image_url   text not null,
  created_at  timestamptz not null default now()
);
create index if not exists checkin_photos_checkin_idx on public.checkin_photos (checkin_id);

alter table public.checkin_photos enable row level security;

drop policy if exists "checkin photos are own" on public.checkin_photos;
create policy "checkin photos are own" on public.checkin_photos
  for select using (auth.uid() = user_id);
drop policy if exists "insert own checkin photo" on public.checkin_photos;
create policy "insert own checkin photo" on public.checkin_photos
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.checkins c where c.id = checkin_id and c.user_id = auth.uid())
  );
drop policy if exists "delete own checkin photo" on public.checkin_photos;
create policy "delete own checkin photo" on public.checkin_photos
  for delete using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- PHOTO LIKES
--
-- One row per person per photo; the primary key makes a double tap a
-- no-op rather than a second like. Members can see every like so the
-- counts add up; you can only add or remove your own.
-- ------------------------------------------------------------
create table if not exists public.photo_likes (
  photo_id    uuid not null references public.photos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (photo_id, user_id)
);

alter table public.photo_likes enable row level security;

drop policy if exists "members read photo likes" on public.photo_likes;
create policy "members read photo likes" on public.photo_likes
  for select to authenticated using (true);
drop policy if exists "insert own photo like" on public.photo_likes;
create policy "insert own photo like" on public.photo_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists "delete own photo like" on public.photo_likes;
create policy "delete own photo like" on public.photo_likes
  for delete using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- STORAGE: list only your own folder
--
-- The old policy let anyone list every file in the bucket, which would
-- hand out the address of every private check-in photo. The bucket is
-- still public, so a file opens for anyone holding its exact address,
-- but addresses end in a random string and can no longer be listed.
-- Listing your own folder is still allowed; account deletion uses it.
-- ------------------------------------------------------------
drop policy if exists "photos storage public read" on storage.objects;
drop policy if exists "photos storage own list" on storage.objects;
create policy "photos storage own list" on storage.objects
  for select using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);


-- ------------------------------------------------------------
-- CLEAN UP: review photos out of the gallery
--
-- Matched on the exact image address, so only true copies of a review
-- photo are removed. They stay on their reviews.
-- ------------------------------------------------------------
delete from public.photos p
 where p.image_url is not null
   and (exists (select 1 from public.food_reviews f where f.photo_url = p.image_url)
     or exists (select 1 from public.festival_reviews r where r.photo_url = p.image_url));
