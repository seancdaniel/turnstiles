-- ============================================================
-- Turnstiles — "Invite a Friend" migration
--
-- This is the COMPLETE and ONLY SQL needed for the invite feature.
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run as many times as you like.
--
-- What it does: creates the log of sent invites. api/invite.js reads
-- this table back to enforce its cap of 10 invites per user per day,
-- and refuses to send at all if the table is missing, so this has to
-- exist before the feature works.
-- ============================================================

create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

-- You can see and add your own invites, and that is all. There is no
-- update or delete policy on purpose: a user who could clear their own
-- rows could reset their own daily cap.
drop policy if exists "invites are own" on public.invites;
create policy "invites are own"
  on public.invites for select
  using (auth.uid() = inviter_id);

drop policy if exists "insert own invite" on public.invites;
create policy "insert own invite"
  on public.invites for insert
  with check (auth.uid() = inviter_id);

-- the cap check filters by inviter and date on every send
create index if not exists invites_inviter_created_idx
  on public.invites (inviter_id, created_at desc);
