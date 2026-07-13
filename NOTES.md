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
- **supabase-data.js** — `loadData()` reads tables into STATE + rerenders; `rerenderActive`; `downscale`/`uploadPhoto` (Storage upload); overrides `enterApp`/`guestBrowse`; real `submitCheckin`/`submitFoodReview`/`submitPhoto`; `deleteCheckin`; `openUserProfile(userId)` (read-only view of another passholder — redirects to your own editable profile if `userId` is you). Clears the demo seed.
- **supabase-food.js** — overrides `loadData` (adds `spot`, `photo_url`, `food_favorites`); food search-and-pick; `submitFoodReview` (new + EDIT via `frEditId` + photo, auto-clears a matching "want to try" favorite on new submit); `getFoodAggregates`/`renderFood` grouped by name+park+spot (click a row -> `openFoodDetail` modal with per-review score/comment/photo + `openUserProfile` link); `renderMyFoodReviews` + `editFoodReview`/`deleteFoodReview` and `renderFoodFavorites` + `rateFavorite`/`removeFavorite`/`toggleFavoriteCurrent` ("Want to Try" list, both on profile); wraps `renderProfile`.
- **leaderboard.js** — `buildLeaderboard` override + `LB_GROUPS` (Disney/Universal); `selectResort`/`selectLbPark`; two-level filter (resort -> park). Water parks folded in: Blizzard Beach + Typhoon Lagoon -> Disney; Volcano Bay -> Universal.

## Supabase
- Tables: `profiles`, `checkins`, `food_reviews` (has `spot`, `photo_url`), `photos`, `food_favorites`. See `supabase/schema.sql`.
- Trigger `on_auth_user_created` auto-creates a profile from signup metadata.
- RLS: public read on everything **except `food_favorites`, which is private (own rows only)** — it's a personal reminder list, not social content; write/update/delete only your own rows everywhere.
- The publishable key in main.js is SAFE (public by design; RLS protects data). NEVER commit the service_role key or DB password.
- Email confirmation is currently OFF (for testing). Before launch: turn it ON and set Supabase Auth -> URL Configuration -> Site URL to the Vercel domain.

## Conventions / gotchas
- After editing any .js/.css, bump its `?v=N` in index.html or the browser serves stale.
- Photos: new uploads are downscaled client-side then pushed to the `photos` Storage bucket via `uploadPhoto()`; `photos.image_url` stores the public Storage URL. Older rows created before this change still have base64 data URLs in `image_url` — both render identically via `<img src>`, no backfill needed.
- STATE is a client cache; call `loadData()` after any write to refresh + rerender.
- Multi-line edits to index.html/*.js were done via a small Python script (io.open read/replace/write) run through Bash — reliable for multi-line HTML.

## Roadmap (not done)
1. **Geolocation check-in verification**: `navigator.geolocation.getCurrentPosition` (one-time) -> geofence vs park coords -> set `checkins.verified = true`. Needs HTTPS (Vercel has it). The `verified` column already exists.
3. **Launch hardening**: re-enable email confirmation + set Supabase Site URL.

### Done
2. **Leaderboard tab styling** — resort/park filters now use the (previously unused) `.lb-tabs`/`.lb-tab` segmented-pill CSS instead of plain `btn-sm` buttons. See `leaderboard.js` `renderLbResortTabs`/`renderLbParkTabs`.
4. **Delete-a-review** — Delete buttons on food reviews (profile -> My Food Reviews) and check-ins (profile -> Visit History), own rows only via RLS. `deleteFoodReview()` in `supabase-food.js`, `deleteCheckin()` in `supabase-data.js`.
4. **Profile editing** — real modal (`overlay-edit-profile`) replaces the old `prompt()`-based edit: avatar, first/last name, username (uniqueness-checked), bio, location. `openEditProfile`/`submitEditProfile` in `supabase-auth.js`.
4. **Supabase Storage for photos** — new uploads (check-in photo, food-review photo, community photo share) now go to a `photos` Storage bucket instead of base64 data URLs in the DB; `uploadPhoto()` in `supabase-data.js`. Existing base64 rows still render fine (no backfill needed).
- **Mobile responsiveness** — the whole app (nav, hero, grids, modals, tables) now adapts down to ~375px: hamburger menu for the logged-in nav, stacking/wrapping layouts, horizontal-scroll tables. Fixed a latent `.modal { min-width: 0 }` flexbox bug along the way (a flex item's default `min-width: auto` let wide descendants force any modal wider than the viewport).
- **Click a food item -> see its reviews** — detail modal per item (score, comment, photo per reviewer). Required moving food-review photos onto the row itself (`food_reviews.photo_url`) instead of only the loosely-linked `photos` table.
- **View another passholder's profile** — read-only modal (bio, tier/badges, stats, recent visits, food reviews), reachable from the leaderboard, activity feed, food-review authors, and photo credits. Clicking your own name/avatar goes to your real editable profile instead.
- **"Want to Try" food favorites** — star an item from its detail modal to save it to a private per-user list shown on your profile; from there, "Rate It" opens the review form pre-filled, and submitting a new review for that item automatically clears it off the list (or remove it manually anytime). New `food_favorites` table, private via RLS.

**Run the full migration block in `supabase/schema.sql` against the live project** — it's cumulative and safe to re-run; covers the delete-food policy, the Storage bucket, `food_reviews.photo_url`, and the new `food_favorites` table/policies.

## Resume in a new chat
Open a new Claude Code session in `C:\Users\SeanDaniel\Desktop\Turnstiles` and say "read NOTES.md and the code, then continue." The repo is the source of truth.
