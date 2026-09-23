-- ============================================================
-- Turnstiles — location-verified check-ins
--
-- Paste the whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run.
--
-- `checkins.verified` has existed since the first schema but nothing
-- enforced it: the insert and update policies only check
-- auth.uid() = user_id, so anyone could POST verified: true. This makes
-- the column mean something:
--
--   1. A trigger stops a signed-in user from ever setting it directly.
--   2. verify_checkin() is the only way to set it, and it does the
--      distance check here on the server, against coordinates the
--      client never sees.
--
-- Be honest about the ceiling. Browser geolocation can be spoofed from
-- devtools, native geolocation on a jailbroken phone. What `verified`
-- truthfully means is "the device reported a position at this park on
-- the day of the visit". That stops casual inflation. It is not proof,
-- and it is a badge only: it gates nothing.
-- ============================================================


-- ------------------------------------------------------------
-- GUARD TRIGGER
--
-- Only applies to the API roles. verify_checkin() is security definer,
-- so inside it current_user is the function owner and the trigger lets
-- its update through. The SQL editor runs as postgres too, so an admin
-- can still fix a row by hand.
--
-- Editing a verified check-in's park or date clears the badge, because
-- the position was checked against the old park and day. Adding miles or
-- a review keeps it.
-- ------------------------------------------------------------
create or replace function public.guard_checkin_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.verified := false;
    elsif new.park is distinct from old.park
       or new.visit_date is distinct from old.visit_date then
      new.verified := false;
    else
      new.verified := old.verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists checkins_guard_verified on public.checkins;
create trigger checkins_guard_verified
  before insert or update on public.checkins
  for each row execute function public.guard_checkin_verified();

-- Nothing in the app has ever set verified, so any true value today was
-- typed at the API by hand. Start clean.
update public.checkins set verified = false where verified;


-- ------------------------------------------------------------
-- verify_checkin(checkin, lat, lng, accuracy)
--
-- Coordinates come from the themeparks.wiki entity API, the same source
-- as the live wait times.
--
-- Nearest park wins, not a plain radius. Universal Studios Florida and
-- Islands of Adventure are 642m apart and a park is over a kilometre
-- across, so "within 1km of the centre" would put you in both at once.
-- Instead your claimed park has to be within its radius AND no more than
-- 250m further away than the nearest park. The 250m slack is for the
-- border between two neighbours, where the nearest point can flip
-- depending on where each park's coordinate happens to sit.
--
-- Epic Universe gets a larger radius because the park is bigger.
--
-- Returns jsonb { ok, reason, nearest, distance }. reason is one of
-- verified, not_found, not_today, imprecise, too_far, wrong_park.
-- ------------------------------------------------------------
create or replace function public.verify_checkin(
  p_checkin_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.checkins%rowtype;
  near_park      text;
  near_dist      double precision;
  claimed_dist   double precision;
  claimed_radius int;
begin
  select * into c from public.checkins
   where id = p_checkin_id and user_id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- where you are right now says nothing about a past visit
  if c.visit_date <> public.park_today() then
    return jsonb_build_object('ok', false, 'reason', 'not_today');
  end if;

  if p_lat is null or p_lng is null
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('ok', false, 'reason', 'imprecise');
  end if;

  -- a Wi-Fi or cell-tower fix can be off by kilometres, which is wider
  -- than the gap between two parks
  if p_accuracy is null or p_accuracy > 500 then
    return jsonb_build_object('ok', false, 'reason', 'imprecise');
  end if;

  with parks(park, lat, lng, radius) as (values
      ('Magic Kingdom',             28.4160036778, -81.5811902834, 1000),
      ('EPCOT',                     28.3762301397, -81.5494047655, 1000),
      ('Hollywood Studios',         28.3584111691, -81.5586892320, 1000),
      ('Animal Kingdom',            28.3553842507, -81.5900898529, 1000),
      ('Universal Studios Florida', 28.4779860000, -81.4683860000, 1000),
      ('Islands of Adventure',      28.4722500000, -81.4675940000, 1000),
      ('Epic Universe',             28.4414454549, -81.4486740912, 1300),
      ('Blizzard Beach',            28.3525184499, -81.5731637729, 1000),
      ('Typhoon Lagoon',            28.3650541008, -81.5278921081, 1000),
      ('Volcano Bay',               28.4613550000, -81.4722860000, 1000)
  ), dist as (
    select park, radius,
           2 * 6371000 * asin(sqrt(
             power(sin(radians(lat - p_lat) / 2), 2) +
             cos(radians(p_lat)) * cos(radians(lat)) *
             power(sin(radians(lng - p_lng) / 2), 2))) as d
      from parks
  )
  select (select park from dist order by d limit 1),
         (select min(d) from dist),
         (select d from dist where park = c.park),
         (select radius from dist where park = c.park)
    into near_park, near_dist, claimed_dist, claimed_radius;

  if claimed_dist is null or claimed_dist > claimed_radius then
    return jsonb_build_object('ok', false, 'reason', 'too_far',
      'nearest', near_park, 'distance', round(coalesce(claimed_dist, near_dist)));
  end if;

  if claimed_dist > near_dist + 250 then
    return jsonb_build_object('ok', false, 'reason', 'wrong_park',
      'nearest', near_park, 'distance', round(claimed_dist));
  end if;

  update public.checkins set verified = true where id = c.id;
  return jsonb_build_object('ok', true, 'reason', 'verified',
    'nearest', near_park, 'distance', round(claimed_dist));
end;
$$;

revoke all on function public.verify_checkin(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.verify_checkin(uuid, double precision, double precision, double precision) to authenticated;
