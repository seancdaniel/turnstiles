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
