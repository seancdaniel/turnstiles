-- ============================================================
-- Turnstiles — live wait times: wait_times.ride_id
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- Why: ride names change. "Expedition Everest" is published as
-- "Expedition Everest - Legend of the Forbidden Mountain", and
-- "Soarin' Around the World" is now "Soarin' Across America".
-- Yesterday's averages group rides by name, so a rename silently
-- splits one ride's history into two half-length averages. This
-- stores the live feed's stable id alongside the name, and the
-- grouping uses it whenever it is present.
-- ============================================================

alter table public.wait_times add column if not exists ride_id text;

-- ------------------------------------------------------------
-- Backfill for the seven rows that existed before this column did.
-- Rows logged from now on carry their id automatically.
--
-- These ids were read from the live feed, and the two commented names
-- are the ones that have since been renamed upstream. This is optional:
-- a null ride_id falls back to grouping by name exactly as before, so
-- skipping it only means those rows stay joined by their old names.
-- ------------------------------------------------------------
update public.wait_times set ride_id = 'de3309ca-97d5-4211-bffe-739fed47e92f'
  where ride_id is null and ride = 'Big Thunder Mountain Railroad';

update public.wait_times set ride_id = '352feb94-e52e-45eb-9c92-e4b44c6b1a9d'
  where ride_id is null and ride = 'Pirates of the Caribbean';

update public.wait_times set ride_id = '480fde8f-fe58-4bfb-b3ab-052a39d4db7c'
  where ride_id is null and ride = 'Spaceship Earth';

update public.wait_times set ride_id = '20b5daa8-e1ea-436f-830c-2d7d18d929b5'
  where ride_id is null and ride = 'Toy Story Mania!';

update public.wait_times set ride_id = '7a5af3b7-9bc1-4962-92d0-3ea9c9ce35f0'
  where ride_id is null and ride = 'Na''vi River Journey';

-- now published as "Expedition Everest - Legend of the Forbidden Mountain"
update public.wait_times set ride_id = '64a6915f-a835-4226-ba5c-8389fc4cade3'
  where ride_id is null and ride = 'Expedition Everest';

-- now published as "Soarin' Across America"
update public.wait_times set ride_id = '81b15dfd-cf6a-466f-be59-3dd65d2a2807'
  where ride_id is null and ride = 'Soarin'' Around the World';
