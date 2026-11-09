# Chalk (working name) — free fitness & discipline tracker

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
- Android: Capacitor 8; health data via `@capgo/capacitor-health` (Health Connect)
- Food data: Open Food Facts API (free, barcode lookup)
- Hosting: Cloudflare Pages, connected to the GitHub repo (every push to `main` auto-deploys;
  build command `npm run build`, output `dist`, env vars prefixed `VITE_`). No Firebase CLI needed.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must pass before committing)
- `npm run lint` / `npm run test`
- `npx cap sync android` — copy the web build into the Android project
- `npx cap open android` — open in Android Studio to build the APK

## Folder layout
```
src/
  app/          routes, layout, tab bar / side nav
  features/     one folder per feature: today, quests, train, food, body, programs, squad, community, profile
  components/   shared UI (Panel, QuestRow, XpBar, RankBadge, StatBlock, Button, TabBar)
  lib/          db (Dexie), firebase, health (Capacitor bridge), xp/levels math, dates, units
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
- Mobile first: bottom tab bar (Quests, Train, Food, Squad, Me). Desktop: left side nav.
- The approved mockups live in the claude.ai design canvas "Discipline app — design directions"
  (B-Web, B-Today, B-Squad). Match them.

## Progression rules
- Daily quests = the user's habits for the day; each has an XP value. Reset at local midnight.
  Two types: checkbox, and number target (e.g. 3 L water, with a + step).
- Quest XP: pick a difficulty (Easy 20 / Medium 40 / Hard 60 / Very hard 90 / Extreme 120),
  then fine-tune between 10 and 150. No unlimited values (keeps pacing and squads fair).
- Finishing all quests: +80 XP bonus. Missing any quest resets the streak.
- XP curve is exponential: +6% per level, base 850 (`lib/xp.ts`, with tests).
  A full default day = 400 XP → Level 10 in ~24 days, Level 50 in ~19 months.
- Ranks use "rank trials" (`lib/rank.ts`): each rank needs a minimum level (E 1, D 5, C 10,
  B 20, A 35, S 50) plus, later, trials from other areas — goals reached, strength relative
  to body weight, progress toward the user's OWN body goal (never body weight itself).
  Untracked stats are skipped. Ranks are earned in order and never drop.
  Only the level trial exists so far; Train/Body/Food add theirs.

## Data model (Firestore, mirrors local Dexie tables)
- `users/{uid}` profile, units (metric/imperial), goals, level, xp, rank
- `users/{uid}/quests/{id}` the user's quest list (title, xp, type, target/unit/step, order)
- `users/{uid}/days/{YYYY-MM-DD}` a copy of that day's quests + progress, steps, sleep, weight, water
  (edits to quests apply to today; past days stay frozen)
- `users/{uid}/workouts/{id}` saved templates; `users/{uid}/sessions/{id}` logged sessions (sets: kg, reps, rpe)
- `users/{uid}/food/{id}` food log entries with macros
- `users/{uid}/programs/{id}` active program state (day N, strict mode)
- `movements/{id}` shared exercise library (read-only for users)
- `squads/{id}` members, shared goal, progress; `community/{id}` public workout posts
Firestore security rules: users can only read/write their own `users/{uid}` tree;
squad data readable by members only; community posts readable by all signed-in users.

## How I work (important)
- I use only the Claude desktop app's Code tab. I never type in a terminal.
- You run every command yourself (npm, git, npx cap, etc.) and start the dev server so the
  app shows in the Browser pane.
- When something needs a step outside this app (GitHub, Firebase console, Cloudflare dashboard,
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
- Never commit secrets: Firebase config goes in `.env.local`; Android keystore files never go in git.
- Default units metric with an imperial toggle. All dates in the user's local time zone.
- "75 Hard" is trademarked — call it "75-day challenge" in the UI.
