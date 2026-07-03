# Turnstiles — Project Notes / Handoff

Theme-park visit tracker. Vanilla HTML/CSS/JS front-end + Supabase backend
(Postgres + Auth). Real accounts, persistent data. Static site, deployed on Vercel.

## Where things live
- Repo (source of truth): https://github.com/seancdaniel/turnstiles  (branch: main)
- Local folder: C:\Users\SeanDaniel\Desktop\Turnstiles
- Hosting: Vercel (auto-deploys from GitHub main)
- Backend: Supabase project https://guglgdsmqbtcvkmvxwrc.supabase.co

## File architecture (SCRIPT LOAD ORDER MATTERS)
index.html loads scripts in this order, each with a `?v=N` cache-buster:
supabase-js CDN -> main.js -> supabase-auth.js -> supabase-data.js -> supabase-food.js -> leaderboard.js

Later files intentionally OVERRIDE functions from earlier ones (plain function
declarations; the last definition wins). That is how the backend was layered on
without heavily rewriting main.js.

- **index.html** — markup: landing shell + app shell (views: home, community, food, photos, profile, about) + modals. Bump `?v=` when editing a script/style.
- **styles.css** — all styles.
- **main.js** — demo/core: `STATE` (in-memory cache), toast/overlay/dropdown helpers, `showView`, guest-browse, form helpers, renderers (`renderLeaderboard`, `renderCommunity`, `renderRecentActivity`, `renderProfile`, `updatePassport`, `updateParkCounts`), `getTier`, `foodEmoji`, demo seed. **The Supabase client is created at the END of main.js**: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `const sb`.
- **supabase-auth.js** — real auth: `profileToUser`, `fetchProfile`, `enterApp`, `doSignIn`, `regSubmit`, `regNext`, `doSignOut`, `restoreSession` (stays logged in across refresh). **Login is by EMAIL**, not username.
- **supabase-data.js** — `loadData()` reads all 4 tables into STATE + rerenders; `rerenderActive`; `downscale` (image shrink); overrides `enterApp`/`guestBrowse`; real `submitCheckin`/`submitFoodReview`/`submitPhoto`. Clears the demo seed.
- **supabase-food.js** — overrides `loadData` (adds `spot`); food search-and-pick; `submitFoodReview` (new + EDIT via `frEditId` + photo); `getFoodAggregates`/`renderFood` grouped by name+park+spot; `renderMyFoodReviews` + `editFoodReview` (profile); wraps `renderProfile`.
- **leaderboard.js** — `buildLeaderboard` override + `LB_GROUPS` (Disney/Universal); `selectResort`/`selectLbPark`; two-level filter (resort -> park). Water parks folded in: Blizzard Beach + Typhoon Lagoon -> Disney; Volcano Bay -> Universal.

## Supabase
- Tables: `profiles`, `checkins`, `food_reviews` (has `spot`), `photos`. See `supabase/schema.sql`.
- Trigger `on_auth_user_created` auto-creates a profile from signup metadata.
- RLS: public read on everything; write/update/delete only your own rows.
- The publishable key in main.js is SAFE (public by design; RLS protects data). NEVER commit the service_role key or DB password.
- Email confirmation is currently OFF (for testing). Before launch: turn it ON and set Supabase Auth -> URL Configuration -> Site URL to the Vercel domain.

## Conventions / gotchas
- After editing any .js/.css, bump its `?v=N` in index.html or the browser serves stale.
- Photos are stored as downscaled base64 data URLs in `photos.image_url` (no Supabase Storage yet). Migrate to Storage if uploads grow.
- STATE is a client cache; call `loadData()` after any write to refresh + rerender.
- Multi-line edits to index.html/*.js were done via a small Python script (io.open read/replace/write) run through Bash — reliable for multi-line HTML.

## Roadmap (not done)
1. **Geolocation check-in verification**: `navigator.geolocation.getCurrentPosition` (one-time) -> geofence vs park coords -> set `checkins.verified = true`. Needs HTTPS (Vercel has it). The `verified` column already exists.
2. **Leaderboard tab styling**: resort/park filter buttons are plain `btn-sm`; make a nicer segmented/pill control.
3. **Launch hardening**: re-enable email confirmation + set Supabase Site URL.
4. Nice-to-haves: Supabase Storage for photos; delete-a-review; profile editing.

## Resume in a new chat
Open a new Claude Code session in `C:\Users\SeanDaniel\Desktop\Turnstiles` and say "read NOTES.md and the code, then continue." The repo is the source of truth.
