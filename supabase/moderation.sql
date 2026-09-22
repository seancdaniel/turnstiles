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
