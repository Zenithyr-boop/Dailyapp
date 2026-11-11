# FromZero — free fitness & discipline tracker

App name: **FromZero** (one word, capital F and Z). Use it in the UI, page titles, PWA manifest,
Android app name and store-style copy. Package/app id for Android: `app.fromzero` (lowercase).

Read this at the start of every session. Keep it up to date when decisions change.

## What we're building
A free app for tracking workouts, food/macros, body weight, steps, sleep and daily habits,
with Solo Leveling-style progression (daily quests, XP, levels, ranks), friends/squads with
shared goals, a community tab for sharing workouts, and habit programs (66-day reset,
75-day challenge, custom). Built by a personal trainer; the core app is free forever.
Paid only where a real person is involved (1:1 coaching, custom programs) — not built yet.

It ships as:
1. A website / installable PWA (works on iPhone, Android, desktop).
2. An Android APK (same code wrapped with Capacitor), distributed via GitHub Releases —
   no Play Store. The APK is the only build that can read steps/sleep from Health Connect.

## Stack
- React + TypeScript (strict) + Vite
- Tailwind CSS v4, design tokens defined in `src/styles/theme.css` with `@theme`
- React Router for pages
- PWA: `vite-plugin-pwa` (offline support, installable)
- Data: local-first. Everything works without an account (IndexedDB via Dexie).
  Signing in syncs to Firebase (Auth + Cloud Firestore), staying inside the free Spark plan.
- Charts: uPlot (Body screens)
- Android: Capacitor 8; health data via `@capgo/capacitor-health` (Health Connect)
- Food data: bundled USDA FoodData Central whole foods + Open Food Facts API (packaged foods, barcodes);
  barcode scanning with BarcodeDetector, `@zxing/browser` as the fallback (see "Food logging")
- Hosting: Firebase Hosting, deployed by GitHub Actions (`FirebaseExtended/action-hosting-deploy@v0`)
  on every push to `main`, using the repo secret `FIREBASE_SERVICE_ACCOUNT`. Pull requests get
  preview channels. Nobody runs `firebase login` or `firebase deploy` by hand.
- Firestore rules live in `firestore.rules`; I paste them into the console (Rules → Publish).
- Google sign-in: a popup on the website; in the APK the native `@capacitor-firebase/authentication` account
  picker (see "Android app").

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must pass before committing)
- `npm run lint` / `npm run test`
- `npm run emulators` + `npm run dev:emulator` — local Firebase Auth emulator (port 9099) and a
  dev server on 5174 that signs in against it with fake accounts (launch configs `auth-emulator`,
  `fromzero-dev-emulator`). Use these to test sign-in; never create test accounts in the real project.
- `npm run import:foods` — rebuild `features/food/library/foods.json` from `foodList.ts` (FDC API with
  `FDC_API_KEY` or DEMO_KEY; `-- --file <SR Legacy JSON>` reads the USDA download instead)
- `npm run android:sync` — build the website and copy it into `android/` (run before every APK build)
- `npm run android:open` — open the Android project in Android Studio
- `npm run icons` — redraw the FZ mark (`scripts/make-icons.ts` → `assets/`, `public/icon.svg`) and regenerate every
  Android icon/splash size
- APK builds (Claude runs these; needs Android Studio installed, it bundles Java): in `android/`, with
  `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"`: `./gradlew assembleDebug`, `./gradlew assembleRelease`,
  `./gradlew signingReport` (SHA-1 fingerprints). Output: `android/app/build/outputs/apk/<debug|release>/`.
  The wrapper is Gradle 9.1 (Android Studio's bundled Java 25 can't run Capacitor's default 8.14); keep it ≥ 9.1.
  `android/local.properties` (git-ignored) has `sdk.dir=C:/Users/kevin/AppData/Local/Android/Sdk` (forward slashes).

## Folder layout
```
src/
  app/          routes, layout, tab bar / side nav
  features/     one folder per feature: today, quests, train, food, body, programs, squad, community, profile
  components/   shared UI (Panel, QuestRow, XpBar, RankBadge, StatBlock, Button, TabBar)
  lib/          db (Dexie), firebase, health (Capacitor bridge), xp/levels math, day (the one source of "today"), units
  styles/       theme.css (tokens), global.css
```

## Design system — "Midnight" (direction B)
Dark, flat, gym-floor feel with a blue "System window" vibe. Never generic "AI app" styling.

Colors (use tokens, never raw hex in components):
| token | hex | use |
|---|---|---|
| `bg` | #0B0E14 | app background |
| `panel` | #121722 | cards/panels |
| `panel-edge` | #1F3554 | 1px panel border (the "System window" edge) |
| `line` | #222A3A | dividers, empty bar tracks |
| `line-soft` | #1A2130 | row separators |
| `text` | #E6EBF5 | primary text |
| `muted` | #93A0B8 | secondary text (passes 4.5:1 on bg) |
| `faint` | #56627A | unchecked box borders, disabled — never body text |
| `accent` | #4DA3FF | primary actions, progress, active tab, XP |
| `rank` | #A796FF | rank badge and level-up moments only |
| `on-accent` | #0B0E14 | text on accent fills |

Type: Barlow Condensed (600–800, uppercase) for headings, numbers and labels;
Barlow (400–600) for body. Load from Google Fonts.

Rules:
- Square corners (0 radius) on panels, buttons, checkboxes. No pill shapes.
- No gradients, glows, neon shadows, glassmorphism or emoji. Flat fills + 1px edges.
- Progress = segmented blocks (XP bar is 10 blocks) or flat bars, not rings.
- Touch targets ≥ 44px. Real `<button>`, `<a>`, `<input>` + `<label>`. aria-labels on icon buttons.
- Icons: simple inline stroke SVGs (1.8px stroke), `currentColor`.
- Mobile first: bottom tab bar (MVP: Quests, Train, Food, Body, Me; Squad returns after the MVP, its page
  stays at /squad). Desktop: left side nav (Programs, Community under "More").
- The approved mockups live in the claude.ai design canvas "Discipline app — design directions"
  (B-Web, B-Today, B-Squad). Match them.

## Progression rules
- Daily quests = the user's habits for the day; each has an XP value. Reset when the user's day
  starts (midnight by default, up to 4 AM; see "Days").
  Three types: checkbox, number target (e.g. 3 L water, with a + step), and automatic (see "Today").
- Quest XP: pick a difficulty (Easy 20 / Medium 40 / Hard 60 / Very hard 90 / Extreme 120),
  then fine-tune between 10 and 150. No unlimited values (keeps pacing and squads fair).
- Finishing all quests: +80 XP bonus. Missing any quest resets the streak.
- Finishing a program: +20 XP per program day, max 2,000 (`programs/templates.ts`), stored on its last day (`Day.bonuses`).
- XP curve is exponential: +6% per level, base 850 (`lib/xp.ts`, with tests).
  A full default day = 400 XP → Level 10 in ~24 days, Level 50 in ~19 months.
- Ranks use "rank trials" (`lib/rank.ts`): each rank needs a minimum level (E 1, D 5, C 10,
  B 20, A 35, S 50) plus, later, trials from other areas — goals reached, strength relative
  to body weight, progress toward the user's OWN body goal (never body weight itself).
  Untracked stats are skipped. Ranks are earned in order and never drop.
  Only the level trial exists so far; Train/Body/Food add theirs (Body can use `goalWeightKg` + the trend).

## Data model (Firestore, mirrors local Dexie tables)
- `users/{uid}` profile: display name, units (metric/imperial) and `heightUnits` (cm/ftin, unset = follows units),
  `onboarding` (done/skipped), `body` (sex, birth year, height cm, weight kg, activity), `plan` (lose/gain + kg per
  week; unset = maintain), `goals` (kcal, protein/fat/carbs g, `macroMode` auto/custom, steps, sleep, water ml),
  `mealNames` (the user's names for breakfast/lunch/dinner/snacks), `dayStartHour` (0–4, unset = midnight), `goalWeightKg`, earned rank and best level (both only go up).
  XP, level and streak are never stored: they're derived from the days (`progressFromDays` in `lib/xp.ts`).
- `users/{uid}/quests/{id}` the user's quest list (title, xp, type, target/unit/step, `link` for automatic quests, order,
  `programId` while it's a program rule)
- `users/{uid}/days/{YYYY-MM-DD}` a copy of that day's quests + progress, steps, `sleepMinutes`, `waterMl`,
  `statsAt` (change time per stat), weigh-in (`weightKg`), `measurements` (waist/chest/hips/arm/thigh cm),
  `bodyAt` (change time per body value), `bonuses` (program finish XP, merged by id)
  (edits to quests apply to today; past days stay frozen)
- Progress photos (`photos` + `photoImages`) are device-only, never uploaded or synced
- `users/{uid}/workouts/{id}` workout templates (items: movement, sets, target by tracking type, RPE, rest, note, superset group); `users/{uid}/sessions/{id}` logged sessions (exercises with targets and sets: kg, reps,
  rpe, seconds, metres, done; no `finishedAt` = still in progress)
- `users/{uid}/food/{id}` food log entries: date, meal slot, `loggedAt`, the food's name/brand/barcode/`foodId`,
  amount (grams, or servings + the serving), a copy of its values per 100 g, `missing` nutrients, and the totals
- `users/{uid}/foods/{id}` the user's custom foods (ids `custom-…`; per 100 g + servings; `basedOn` = barcode of an
  Open Food Facts product they completed); `users/{uid}/favorites/{foodId}` favourite foods (with a copy of the food);
  `users/{uid}/savedMeals/{id}` saved meals (name + portions)
- The Open Food Facts product cache (`offProducts`) is device-only, never synced
- `users/{uid}/programs/{id}` programs: template `kind`, name, length, strict, starting rules, `startDate` (day 1 of the
  current attempt), `attempts`, status (active/finished/ended), `questIds` (added) and `adopted` (taken over + their
  fields before), finish `daysDone`/`bonusXp`, `released`. Day N and the grid are derived from the days
- `users/{uid}/movements/{id}` the user's custom movements (ids start with `custom-`)
- The shared movement library is NOT in Firestore: it's bundled with the app (see "Movement library")
- `squads/{id}` members, shared goal, progress; `community/{id}` public workout posts
Firestore security rules: users can only read/write their own `users/{uid}` tree;
squad data readable by members only; community posts readable by all signed-in users.

## Movement library (`src/features/train/library`)
- Source: free-exercise-db by yuhonas (Unlicense), credited in About on the Me screen. Pinned to one
  commit in `dataset.ts`; `npm run import:exercises` rewrites `exercises.json` from it.
- `exercises.json` is bundled and loaded on demand (own chunk, precached) — browsing costs no reads.
  Movement ids are the dataset's ids and must never change: logged sets point at them.
- Photos load from the repo's raw GitHub URLs only when a movement is opened; the service worker
  caches them (`movement-photos`, CORS requests). No service worker in the APK, so photos need a connection there.
- Editable by the coach: `trackingTypes.ts` (how each movement is logged: weight_reps, bodyweight_reps,
  assisted, time, distance_time; the import keeps edits and only guesses new ones) and
  `coachPicks.ts` (ids that show first and always rank first in search). Tests check every id exists.
- Search (`search.ts`, unit-tested): typos, partial words, aliases (RDL, OHP, DB…). Ranking: coach's
  picks, then custom movements, then the rest. Filters: muscle (primary only), equipment, category.

## Workouts (`src/features/train/workouts`)
- Templates live on the Train tab; the builder is `/train/workouts/:id` (`/train/workouts/new` for a blank one).
  Edits stay in a draft until Save; leaving with unsaved changes asks first. The library picker opens over
  the builder (`?add=1`, so phone Back closes it).
- Targets follow the movement's tracking type (`targets.ts`): rep range for weight/bodyweight/assisted, seconds
  for time, minutes (+ optional metres) for distance.
- Supersets = neighbouring items sharing a `group` (`supersets.ts`). Only the last movement of a round rests.
- Estimated duration (`duration.ts`): ~4 s per rep + 10 s setup per set (or the time target), rest after every set
  but the last, plus 2 min per movement for warm-up and changeover.
- Starter templates (`starters.ts`, editable by the coach) are bundled with fixed `starter-…` ids and stored only
  once edited or deleted, so new devices stay "untouched" on first sign-in and devices never duplicate them.
  Never change a starter id.

## Days (`src/lib/day.ts`)
- The one source of "today". Day keys are `YYYY-MM-DD` in local time; the day starts at the profile's `dayStartHour`
  (Me → Day starts at: midnight–4 AM), so 00:30 with a 4 AM start still belongs to the previous day. Keys are worked out
  from the local date + hour, never by adding milliseconds (DST-safe). Never write another "today" helper.
- Data code: `await getToday()` (reads the profile). Screens: `useToday()` / `useDayClock()` (today, start hour, ms left).
- `dayClock` (started in `main.tsx` via `app/dayRollover.ts`) re-reads the real clock on open, `visibilitychange`, `focus`,
  `pageshow` and at every minute boundary, rescheduling after every check, so paused (sleep) or early timers can't leave
  the app on yesterday. The day-start hour is cached in localStorage so the first check after opening is right.
- Closing out (`features/quests/closeOut.ts`, on open, on every day change and after sync pulls days): days since the last
  record get an all-unchecked record (misses on record, streak breaks; capped at 90 days), then today's record.
  XP, the +80 bonus, level and streak stay derived (`progressFromDays`). Gap records hold no progress, so `mergeDay`
  never lets them remove another device's ticks.
- Grace: quests can be changed today and yesterday only (`canEditQuests`, enforced in `questsRepo` with
  `DayLockedError`); older days are read-only; no future days anywhere. Food and workouts can be added on any past day;
  a past-day workout ticks that day's Train quest only inside the grace window (`TrainQuestResult` `locked`).
- Shared `components/DateSwitcher` ("‹ Today ›" + month picker, `?date=` / `?pick=1` in the URL) on Quests, Food and
  Train. `components/MonthCalendar` (weeks start Monday) also drives Day history (`/quests/history?month=&day=`): each
  day marked full/partial/missed with "4/6"; a day's summary shows quests, XP, food vs targets, workouts, weight.
- Tests use vitest fake timers (`lib/day.test.ts` pins TZ to America/New_York with `vi.stubEnv`; `closeOut.test.ts`
  fakes only Date because fake-indexeddb needs real timers).

## Sessions / live logging (`src/features/train/sessions`)
- One session in progress at a time (`/train/session`); a "Resume session" banner shows on Quests and Train.
  A session's `date` is the day it started (or the past day picked on Train → "Log a workout for …").
  Every edit is written to Dexie at once (`sessionsRepo.ts`), so a refresh never loses a set. Weight fields
  commit on blur/Enter; ticking a set saves it.
- Weights are stored in kg. `weights.ts` shows them in the user's units (profile `units`, toggle on Me and in the
  logger), rounding converted values to `PLATE_STEP`; values typed in that unit come back exactly.
- Rest timer (`restTimer.ts`): starts on tick with the movement's rest (inside a superset only after the last
  movement), end time in device-only meta, beep + vibrate at zero. The screen stays on while a session is open:
  Screen Wake Lock on the website, `@capacitor-community/keep-awake` in the APK (`useWakeLock`).
- Finishing keeps only ticked sets; the session day's automatic Workout quest ticks itself (`TrainQuestResult` reports
  checked / already / missing / locked). Deleting the session unticks it again inside the grace window.
- `records.ts`: Epley e1RM, PRs vs earlier sessions (none on a movement's first log), "last time", totals.
- `progression.ts` — tunable by the coach: next-time rule, +2.5 kg lower body / +1.25 kg upper body (by primary
  muscle), plate steps.

## Food logging (`src/features/food`)
- Food tab (`/food`, `?date=` for earlier days, never future; shared date switcher): calories as a 10-block bar and protein/carbs/fat as flat bars against
  the saved goals, then four meals (names editable) with per-meal totals. A meal's ⋯ menu: copy the day before's
  meal, save as a meal, rename. "Copy yesterday" copies a whole day. Tapping an entry edits/moves/removes it (`?entry=`).
- Add food (`/food/add?meal=&date=`): one search over everything on the device (bundled USDA foods, custom foods,
  favourites, cached packaged products; `search.ts`, unit-tested: typos, partial words, UK words like courgette/mince).
  Ranking: own foods, then favourites, nudged ahead of equal matches. Empty search shows tabs: Recent (from the log),
  Favourites, My foods, Saved meals (log in one tap). Dialogs live in the URL (`?food=`, `?scan=1`, `?quick=1`) so
  Back closes them. The food dialog logs by servings, grams or ounces; quick add = just kcal + macros (kcal from 4/4/9
  if empty).
- Every entry stores the food's values, so copying meals/days, recents and saved meals never need a lookup.
  `loggedAt` only goes up, so entries keep their order. All amounts in grams (ounces only for display/input).
- USDA list (`library/`): ~340 whole foods from FoodData Central SR Legacy (public domain). `foodList.ts` is the
  coach's list (FDC id, display name, group, `SERVING_OVERRIDES`); `npm run import:foods` writes `foods.json`
  (own chunk, loaded on demand, precached). Ids are `usda-<fdcId>`: never change them. Tests check the list.
- Open Food Facts (`off.ts`): identifies as `FromZero/0.1.0 (https://fromzero-ce670.web.app)` in `X-User-Agent`
  (browsers can't set User-Agent). Product reads via `/api/v2/product/{code}`; text search via `/cgi/search.pl`
  ONLY when the user submits (their rule: no search-as-you-type; their newer search server has no CORS). Client limiter
  at 14 reads / 9 searches a minute, backoff with jitter on 429/503. Dev server uses the staging server
  (world.openfoodfacts.net, login off/off) unless `VITE_OFF_SERVER=production`; builds use production.
  Every fetched product is cached in `offProducts` (fresh 30 days, "not found" 1 day; stale copy used offline).
  Missing nutrients are listed and count as 0; kcal falls back to kJ ÷ 4.184 (flagged). "Fill in the gaps" makes a
  custom copy (`basedOn`), which wins on later scans/lookups and fixes that product's incomplete log entries.
- Scanning (`scan/scanner.ts`): native BarcodeDetector where available, else `@zxing/browser` (lazy chunk);
  UPC-E is expanded to UPC-A. Typing the number always works. The APK declares `CAMERA` (optional camera feature);
  Capacitor asks for it when the scanner opens.
- Credits for USDA and Open Food Facts (ODbL) are in About on the Me screen.

## Today: automatic quests, daily stats, dashboard (`src/features/quests`, `src/features/today`)
- Automatic quests are checkbox quests with a `link` (`links.ts`, unit-tested; defaults/limits for the coach at the
  top): steps ≥ N, sleep ≥ N min, protein ≥ goal, calories within ± N kcal of goal (needs food logged), weighed in,
  water ≥ N ml, finished a workout, progress photo that day. Protein/calories follow Me → Goals and say so when the goal
  is missing. Photos never sync, so a photo quest only ever ticks itself (never unticks on a device without the photo).
- `autoQuests.ts`: `refreshAutoQuests()` re-evaluates today's and yesterday's automatic quests and writes `done`
  (+ `at`) only when it changes; `startAutoQuests()` (main.tsx) runs it on every change via a Dexie liveQuery
  (food, sessions, day stats/weigh-in, goals, quest edits, synced data). Older days stay frozen. Only `done` is
  stored; live numbers are computed on screen (`linkDataFor`). They can't be ticked by hand (`setQuestDone` skips them).
- db v9 made existing "Train" quests automatic Workout quests. New users' Train, protein and steps quests are
  automatic; starter water, calories and weigh-in options too. Other existing quests change only if the user edits them.
- Daily stats (`today/statsRepo.ts`): steps, sleep, water typed by hand for any day up to today (`?stat=steps|sleep|water`
  dialogs); the APK also fills steps/sleep (and weight) from Health Connect (see "Android app"). `addWater` reads and
  writes in one transaction.
- Quests screen: Today strip (steps, sleep, kcal, protein) above the quests on every size. Desktop (`lg`) is a wide
  two-column dashboard (route `handle: { wide: true }` widens the shell): rank/level/XP header, daily quests, then
  Volume this week (Mon–Sun flat bars vs last week, `week.ts`), today's food, weight trend (`DashboardPanels.tsx`).
- Tests that tick every default quest by hand call `useManualQuests()` (`src/test/manualQuests.ts`).

## Programs (`src/features/programs`)
- Templates in `templates.ts` (coach-editable; template ids are stored, never change them): 66-day reset (user picks
  habits from their quests, ideas or new ones; not strict), 75-day challenge (fixed rules: two 45-min workouts, one
  outdoors, diet, 3.8 L water auto, 10 pages, progress photo auto; strict by default), custom (name, 7–365 days, up to
  12 rules of any quest type, strict on/off). Builder: `/programs/new/:template`. Day 1 = the day it starts.
- One active program at a time (`ActiveProgramError`). Its rules are real quests tagged `programId` (tag with the program
  name on Quests). A quest the user already has (same link source, or same title + type) is taken over instead of
  doubled and given back with its old fields when the program is over. Program quests can't be deleted
  (`ProgramQuestError`); onboarding's `setQuestList` leaves them alone; edits keep the tag.
- `progress.ts` (pure, unit-tested): a day counts when every rule on that day's record is done; a day is missed only once
  it's closed (older than yesterday). Strict: a miss ends the attempt and the next starts the day after the missed day.
  Not strict: misses are marked. Finished = every day done (strict) or done/closed (not strict).
- `programsRepo.ts`: `startPrograms()` (main.tsx) runs `refreshPrograms()` on program/day changes and new days: saves
  strict restarts as `attempts`, puts missing rules on today's record, and on finish sets status, the day bonus on the
  last day, a device-only celebration (`programCelebration` meta, rank-violet `ProgramCompleteDialog`, shown before a
  level-up). A finished program keeps its quests until its last day is over (`released`), so that day's XP stays.
  Ending a program removes its quests from today at once (with today's ticks on them) and records the attempt.
- `/programs`: active program (Day N of L, 66 = 11×6 grid, legend, rules, End), past attempts, the three templates,
  past programs. Quests shows a "Day N of L" strip; Me shows finished programs as badges (`BadgesPanel`).

## Body (`src/features/body`)
- `/body`: one-field daily weigh-in (Enter saves), weight chart (raw weigh-ins as dots, 7-day moving average as the
  line, ranges 1M–All in `?range=`), trend weight, weekly rate, goal weight (`?goal=1`) and estimated date, weigh-in
  list (`?weigh=<date>` edits/removes, `?weigh=new` logs any past day). Summaries link to measurements and photos.
- `trend.ts` (unit-tested, numbers tunable at the top): moving average over 7 calendar days; weekly rate = least-squares
  slope of the last 28 days (needs 4 weigh-ins over 7+ days); estimate only when heading toward the goal, max 2 years.
- `bodyRepo.ts`: `saveBody(date, changes)` sets/clears values on the day record, stamping `bodyAt[field]`; any day up to
  today. A missing day gets unchecked quests inside the quest history, or no quests before the first quest day.
  Body-only records never start the history or back-fill misses (`firstQuestDate`, closeOut skips them).
  The latest weigh-in updates profile `body.weightKg`; targets change only when Goals are saved.
- Sync: `mergeDay` merges each body value by its `bodyAt` time, so a removed weigh-in stays removed.
- `/body/measurements`: shared date switcher (`?date=`), five optional fields with how-to hints (`units.ts`, coach-editable),
  chart + history per measurement (`?m=`). Stored in cm; shown in inches when the height unit is ft/in.
- Charts: uPlot (`chart/UPlotChart.tsx`, own lazy chunk), colours read from the Midnight CSS tokens, readout + "Show as
  table" in `TrendChart.tsx`. Not drawn in the test DOM (no canvas).
- Photos (`/body/photos`, `/body/photos/compare?a=&b=&pose=`): resized to 1600 px JPEG + thumbnail (`photos/image.ts`),
  stored as ArrayBuffers in Dexie only; `navigator.storage.persist()` is requested. The UI says plainly that photos are
  never uploaded and don't sync between devices yet. Optional pose (front/side/back) for like-with-like compare.

## Onboarding & goals (`src/features/onboarding`, `src/features/profile/goals`)
- First run: `OnboardingGate` (wraps the app shell) sends a profile without `onboarding` to `/welcome` — one
  question per screen (name, units, sex, birth year, height, weight, activity, goal, rate), then targets, then
  starter quests (`starterQuests.ts`, editable by the coach). Every question can be skipped; "Skip setup" keeps the
  default quests. Answers stay in a draft until the end. "Sign in" on the first screen: an account whose profile
  is already onboarded closes the flow. Profiles from before onboarding were marked done by the db v6 upgrade.
- Skipping stores nothing but the flag, so an untouched device still counts as pristine on first sign-in.
- All tunable numbers live in `coachTargets.ts`: Mifflin-St Jeor constants ("prefer not to say" = midpoint),
  activity multipliers, 7,700 kcal/kg, loss cap 1% of body weight a week, calorie floors by sex, protein g/kg by
  goal, BMI-30 reference weight for heavier people, fat 25% of kcal with a g/kg minimum, rate options (kg and lb).
  The maths is `targets.ts` (unit-tested). Macros: protein, then fat, carbs are the rest (fat drops to its minimum
  before carbs go below 0). Fastest rate shows a gentle note; cap and floor show what happened.
- Me → Goals (`/me/goals`): edit everything, targets recalculate live; draft until Save, leaving asks first.
  "Set my own numbers" = `macroMode: 'custom'` (warns below the floor, doesn't block).
- Targets are saved, not derived on load: changing `coachTargets.ts` affects a user the next time they save goals.

## Account sync (`src/lib/sync`)
- Dexie is the source of truth on the device; Firestore is the cloud copy. Signed out = local only.
- Every synced record has `updatedAt` and a `dirty` flag, set by Dexie hooks in `lib/db.ts` on
  every local write. Deletes are tombstones (`deleted: 1`), never hard deletes.
  Engine writes (applying cloud data) go through `runAsSync` so they aren't re-flagged.
- Uploads: debounced 2 s, batched, wait while offline. Each doc gets `syncedAt` = server time
  (rules enforce it); listeners pull only docs with `syncedAt` after the stored cursor.
- Merge rules live in `lib/sync/merge.ts` (unit-tested): newer `updatedAt` wins; day quests merge
  quest by quest using each quest's `at` time, and when both devices had unsent changes a quest
  checked on either counts as checked (count quests keep the max); rank/best level take the max.
- First sign-in on a device: empty account → upload all; untouched device → take the account's
  data; otherwise match starter quests by name+type, then merge. Never drop user data silently.
- Firestore reads/writes are counted per day on the device (`lib/sync/usage.ts`, shown on Me).
- Firestore has no local emulator here (needs Java); test sync with two browsers on a PR preview.

## Android app (`android/`, `capacitor.config.ts`)
- Capacitor 8 wraps the same web build: appId `app.fromzero`, name FromZero, minSdk 26 (Health Connect), target 36.
  `src/lib/platform.ts` (`isNativeApp`/`isAndroidApp`) gates every native feature; each is a no-op on the website.
  No service worker in the APK (`main.tsx` registers it only on the web). Status bar: dark (`SystemBars`), the page pads
  itself with `env(safe-area-inset-*)`. Splash: FZ mark on bg, hidden by `main.tsx` after the first render.
- Icon/splash: flat square "FZ" mark drawn in `scripts/make-icons.ts` (`npm run icons`). Never hand-edit generated PNGs.
- Version: `versionName` = package.json `version`; `versionCode` is derived from it (1.2.3 → 10203) in
  `android/app/build.gradle`, so bumping package.json bumps both. Every release needs a higher version.
- Health Connect (`src/lib/health`: `bridge.ts` plugin calls, `days.ts` pure + tested): reads ONLY steps (hourly
  aggregates, de-duplicated by Health Connect), sleep (asleep stages, on the wake-up day, overlaps once) and weight
  (last of the day). The manifest strips every other health permission the plugin declares (`tools:node="remove"`).
  `features/today/healthSync.ts` writes through `saveStats`/`saveBody` (so `statsAt`/`bodyAt` + sync work) on open and
  on resume (`App` resume + `visibilitychange`); 30 days on connect, then from the day before the last sync. Device-only
  meta `health` keeps what was imported per day: a hand-corrected value stays until Health Connect has a new number.
  `startAutoQuests` picks the writes up (tested in `healthSync.test.ts`).
- Explanation screen `/me/health` (steps + sleep on, weight opt-in) before the system sheet. Privacy policy: one text in
  `features/legal/privacyPolicy.ts`, shown at `/privacy` and built into `privacypolicy.html` (script-free, for Health
  Connect's rationale WebView, which runs no JS; also served by the website). Update it when data use changes.
- Native Google sign-in: `@capacitor-firebase/authentication` with `skipNativeAuth`; its ID token signs in to the
  Firebase web SDK (`lib/auth.ts`), also for re-auth; sign-out clears the native session. The APK's Auth uses
  `initializeAuth` + IndexedDB persistence (no popup resolver). Needs `android/app/google-services.json`.
  `firebase` 13 vs the plugin's peer range is bridged with an npm `overrides` entry (the plugin only passes a token).
- `google-services.json` is NOT a secret (same public config as `.env`; Google sign-in is locked to the package name +
  SHA-1 fingerprints), so it's committed. Re-download it after adding fingerprints.
- Update check (`lib/updates.ts`, `app/UpdateBanner.tsx`): on launch the APK compares `App.getInfo().version` with the
  latest GitHub Release of `Zenithyr-boop/Dailyapp` (public API, cached 6 h, "Later" skips that version); the banner's
  Download opens the release's `.apk` in the phone's browser. The repo must stay public for this and for downloads.
- Barcode camera: `CAMERA` permission. Keep-awake during sessions: `@capacitor-community/keep-awake`.
- Signing: release keystore at `C:\Users\kevin\FromZero-keys\fromzero-release.jks` (outside the repo, backed up, password
  in a password manager). `android/keystore.properties` (git-ignored) holds `storeFile`, `storePassword`, `keyAlias`,
  `keyPassword`. Losing the keystore means users must uninstall to update: keep two copies.

### Release steps (Claude runs them; the user approves publishing)
1. Bump `version` in package.json (e.g. 0.2.0), commit on the release branch/PR, merge to main.
2. `npm run android:sync`, then in `android/`: `./gradlew assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.
3. Rename to `FromZero-<version>.apk`, then `gh release create v<version> <apk> --title "FromZero <version>" --notes "…"`.
   The tag must be `v` + package.json's version, or the update check won't match.
Same in Android Studio: Build → Generate Signed App Bundle or APK… → APK → Next → choose the keystore → Next → release →
Create; then on github.com: the repo → Releases → Draft a new release → tag `v<version>` → attach the APK → Publish release.

## How I work (important)
- I use only the Claude desktop app's Code tab. I never type in a terminal.
- You run every command yourself (npm, git, npx cap, etc.) and start the dev server so the
  app shows in the Browser pane.
- When something needs a step outside this app (GitHub website, Firebase console,
  Android Studio), give me short click-by-click instructions with the exact button names.
- Firestore security rules: write them to `firestore.rules` and tell me to paste them into
  Firebase console → Firestore → Rules → Publish.
- GitHub sign-in goes through the GitHub CLI (`gh auth login --web`, then `gh auth setup-git`).
  If a push fails on sign-in, re-run that and show me the one-time code to enter at
  github.com/login/device. I don't use GitHub Desktop.

## Working agreement
- Plan first for anything touching more than a couple of files; wait for my OK.
- One feature per session/branch. Run `npm run build` (and tests) before saying it's done.
- Commit in small steps with clear messages.
- The Firebase web config is public by design (security comes from Firestore rules), so it lives in
  a committed `.env` as `VITE_FIREBASE_*` variables. Real secrets never go in git: the service
  account JSON (GitHub secret only) and Android keystore files.
- Default units metric with an imperial toggle. All dates in the user's local time zone.
- "75 Hard" is trademarked — call it "75-day challenge" in the UI.
