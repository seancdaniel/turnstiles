# App Store listing: draft

Everything App Store Connect asks for, ready to paste. Nothing here is live
until it is typed into App Store Connect. **Never put the demo account's
password in this file**; it goes only in App Store Connect's App Review
Information fields.

Character limits are Apple's; counts are shown where they matter.

---

## App information

| Field | Value |
|---|---|
| Name (30 max) | **Turnstiles: Theme Park Log** (26) |
| Subtitle (30 max) | **Track visits, rate park food** (28) |
| Bundle ID | `com.goturnstiles.app` (already in the Xcode project) |
| Primary category | Travel |
| Secondary category | Social Networking |
| Content rights | Does not contain third party content it lacks rights to (users post their own photos; the Terms require it) |
| Copyright | `2026 Sean Daniel` (Individual account) or `2026 Turnstiles LLC` (Organization) |

**No Disney, Universal, park or ride names in the name, subtitle or keywords.**
That is where reviewers and rights holders are strictest. The description may
name parks factually (it says what the app covers), but never as if endorsed.

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL | https://goturnstiles.com/privacy |
| Support URL | https://goturnstiles.com/support (opens the Contact box, help@goturnstiles.com) |
| Marketing URL (optional) | https://goturnstiles.com |

## Promotional text (170 max, can change any time without review)

> Log every park day, see who's been the most this month, and find the best snacks in Orlando, rated by the passholders who actually ate them.

## Description

> Turnstiles is the tracker for people who go to the parks a lot.
>
> LOG EVERY VISIT
> Check in at the Orlando theme parks and water parks in a couple of taps. Add the miles you walked when you get home. If you're standing in the park, verify your check-in with your location and earn a Verified badge.
>
> CLIMB THE LEADERBOARD
> See who has visited the most this month and this year, earn tiers as your count grows, and compare notes with other passholders.
>
> RATE THE FOOD
> Score what you ate and see the community's top rated snacks and meals at every park, plus a dedicated section for the EPCOT festivals.
>
> TALLY YOUR FAVORITES
> Count your rides and your churros. Ride and snack leaderboards show who has done the most, today and all time.
>
> WAIT TIMES
> See posted wait times, live, and log how long the line really took so everyone knows which signs to trust.
>
> SHARE YOUR PHOTOS
> Keep photos with your check-ins, and share the ones you choose to the community gallery.
>
> Turnstiles is free, made by one theme park fan, and not affiliated with or endorsed by Disney, Universal, or any park operator.

## Keywords (100 max, comma separated, no spaces)

```
orlando,passholder,annual pass,wait times,park food,ride tracker,leaderboard,check in,water park
```
(96 characters. Apple already indexes the name and subtitle, so words from
those are not repeated here.)

---

## App Privacy ("nutrition label")

**Tracking: No.** The app does not track people across other companies' apps
or websites, and shows no ads.

Data collected, all **linked to the user** unless noted, all for **App
Functionality** only:

| Apple category | Data type | Why |
|---|---|---|
| Contact Info | Name | Account profile |
| Contact Info | Email Address | Login and account emails; also a friend's address when you send an invite |
| User Content | Photos or Videos | Check-in photos, profile photo, gallery, review photos |
| User Content | Other User Content | Check-ins, reviews, wait times, tallies, bio, home location text, pass types |
| Identifiers | User ID | The account ID every row is stored under |
| Diagnostics | Crash Data | Sentry error reports. **Not linked** to the user |

**Location: not collected** under Apple's definition. The device position is
sent once to verify a check-in, used in that request, and never stored; only
the Verified result is saved. If a reviewer pushes back, declaring Precise
Location (App Functionality, linked) is also accurate and harmless.

**Usage Data: not collected in the app.** Vercel Web Analytics only runs on the
website; inside the app its script cannot load.

## Age rating questionnaire

Answer honestly; the likely answers:

- User-generated content: **Yes**, with reporting, blocking, a zero tolerance
  policy in the Terms, and reports reviewed within 24 hours.
- Messaging or chat: **No** (there is no direct messaging).
- Alcohol, tobacco or drug references: **Infrequent/Mild** (the Margaritas and
  Butterbeer snack tallies, festival food reviews).
- Everything else (violence, sexual content, gambling, horror, medical): **None**.

Expect roughly a 13+ rating, which matches the Terms' age floor.

## App Review information

**Demo account.** Members only means the reviewer sees nothing without logging
in. Before submitting, create a real account for review (e.g.
`appreview@goturnstiles.com`), confirm its email, and give it a few check-ins,
a food review, a wait time and a shared photo so every screen has content.
Put its email and password **only** in App Store Connect.

**Notes for the reviewer** (paste as is, it is under 4000 characters):

> Turnstiles is a free companion for theme park passholders in Orlando. A demo account is provided above; the community content you'll see comes from real members.
>
> Location: when checking in, members can optionally tap "Verify I'm at the park". The device location is read once, compared with the park's coordinates on our server, and discarded. Only a Verified badge is saved. You can deny location and still check in normally.
>
> User generated content (Guideline 1.2): new members must agree to the Terms, which include a zero tolerance rule for objectionable content. Every photo and review has a Report option, members can block other members from their profile, and reports are emailed to us and reviewed within 24 hours from an admin queue in the app.
>
> Account deletion (Guideline 5.1.1(v)): Edit Profile, then Delete Account.
>
> Turnstiles is not affiliated with Disney, Universal or any park operator. Park names are used only to describe where a visit happened.

---

## Decisions still open

1. **Individual or Organization** enrollment. Decides the seller name shown on
   the store and the copyright line.
2. **Franchise tier names (yearly ladder).** Not checked against the USPTO;
   what matters for Apple (5.2) is recognisable franchise references, not
   registration. Low practical risk inside the app, trivial to rename. The
   monthly ladder went back to Bronze..Grandmaster on 2026-09-28. Yearly:

   | Current | Owner | Possible replacement |
   |---|---|---|
   | Dopey | Disney | Rookie |
   | Park Hopper | Disney (ticket product) | Hopper |
   | Galaxy Defender | Men in Black ride | Space Ranger (also Disney, avoid) / Star Defender |
   | Tri-Wizard Cup | Harry Potter | Triple Crown |
   | Club 33 | Disney | Inner Circle |

   Renaming only changes labels in `MONTHLY_TIERS`/`YEARLY_TIERS` in main.js;
   tiers are computed from counts, so no data changes.
3. **Screenshots.** Apple requires 6.9 inch iPhone screenshots (1320 x 2868).
   Plan: generate them on GitHub's Mac simulator, signed in as the demo
   account, once it has content.
