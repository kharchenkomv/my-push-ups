# My Push Ups

An offline, no-login push-up trainer mobile app: a tiny daily habit set, auto-progressing toward a user's goal (e.g. 100 push-ups). (The former strength track was removed 2026-07-10 — habit-only now.)

## Run & Operate

Since the 2026-07-09 migration off Replit, `pnpm --filter @workspace/my-push-ups run dev`
is Replit-specific (reads `$REPLIT_EXPO_DEV_DOMAIN` etc.) and must not be run locally.
Use, from `artifacts/my-push-ups`:

- `pnpm exec expo start --web --port 21401` — Expo web preview
- `pnpm run test` — training-engine test suite (pure functions, no simulator needed)
- `pnpm run typecheck` — typecheck this app only
- `pnpm run typecheck` from the repo root — full typecheck across all workspace packages
- No env vars or database required — the app is fully offline (AsyncStorage only)

See root `CLAUDE.md` for the canonical local-dev commands and macOS-specific setup notes.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54 + expo-router (tabs), React Native
- Storage: @react-native-async-storage/async-storage (key `mpu:data:v1`)
- Extras: react-native-svg (rest ring, launch mark), react-native-reanimated (launch
  animation), expo-haptics, expo-notifications (reminders), Inter + Playfair Display fonts
- The api-server and mockup-sandbox artifacts are scaffolding; the push-up app does not use them

## Where things live

- `artifacts/my-push-ups/lib/training.ts` — the entire training engine (formulas, progression, deload, level-up, week eval, import sanitization) + date helpers
- `artifacts/my-push-ups/lib/types.ts` — AppData / Settings / SessionEntry types
- `artifacts/my-push-ups/context/AppContext.tsx` — single state provider; atomic `mutate()` with serialized AsyncStorage writes
- `artifacts/my-push-ups/app/onboarding.tsx` — welcome → goal → health screening → level → max test → preview (also exports `Stepper`)
- `artifacts/my-push-ups/app/workout.tsx` — big-circle workout flow (`track` param: `habit` | `maxtest`)
- `artifacts/my-push-ups/app/(tabs)/` — Today / Plan / Progress / Settings screens; `_layout.tsx` holds the onboarding redirect gate
- `artifacts/my-push-ups/lib/notifications.ts` — weekly local reminders (dynamic import, web-guarded)

## Architecture decisions

- All training logic is pure functions in `lib/training.ts` so it's testable and UI-independent
- **Strength engine** (adopted 2026-07-19, per `pushup_strength_methodology.md` — replaced the older habit engine and its `attached_assets` spec). It is **purely max-based**: one `maxTests` number drives everything; there is no fitness-level ladder (wall/incline/knee/full is gone).
- A day's 5 rounds are a submaximal share of the current max: base `[60,60,55,55,50]%`, each round floored and held in the band `[3, floor(0.70×max)]` (`roundRepFromPct`). Real progression comes from re-testing the max, not from daily bumps.
- **7-day microcycle** keyed on `dayNumber` (global 1-based counter in AppData), NOT weekday. `microPosOf(dayNumber)` → 1..7: days 1–5 progressive (cumulative bumps `+R5,+R1,+R2,+R3` on days 2–5), day 6 hold (= day 5), day 7 technical (`[50,50,45,45,40]%`). `planForDay(max, dayNumber)` yields `{dayNumber, microPos, type, rounds[5], total}`; `planForDate(data)` is today's.
- **Progression = advance the microcycle, not a weekly scalar.** `completeSession` calls `advanceDayNumber` (+1) — and only on completion, so a skipped calendar day repeats the same prescription (methodology §Step 5). There is no `evaluateWeek`/`dailyTarget` anymore.
- `habitDaysPerWeek` (5/6/7) still gates which calendar days prompt a session; the microcycle advances independently on each completed session. Rest is user-set (`settings.restSeconds`, up to 180 s — strength favours longer rests). Max re-test prompted after `RETEST_DAYS` = 14.
- Import/export is plain JSON via share sheet / paste; `sanitizeImport` also **migrates habit-era backups** — drops `level`/`dailyTarget`/`lastWeekEvaluated` and synthesizes `dayNumber` from the completed-session count.

## Product

- 4 tabs: Today (today's 5-round exercise card, streak/best/max stats), Plan (current max + the 7-day cycle map + today's prescription + progression explainer), Progress (streak, push-ups-over-time chart, dot grid, milestones, max-test history), Settings (habit days, goal, rest, reminder, export/import/reset, health screening — no level override)
- Onboarding is welcome → goal → health check → max test (the level-picker step was removed with the strength engine); a physician warning shows when any health question is answered yes
- Design language "Quiet Ritual" (adopted 2026-07-19, matching the sibling Habit-Visualizer
  app): cream `#fbf9f2` canvas, terracotta `#a4542f` primary, Playfair Display serif
  headings + Inter body text, hairline borders, no colored shadows. Full dark mode.
  Haptics on round/rest transitions. The app mark (ring + push-up figure) is traced from
  the original logo artwork (`scripts/trace-logo.js` → `components/figurePaths.ts`) and
  shared by the icon, the welcome screen, and the launch animation
  (`components/LaunchAnimation.tsx`, a Reanimated overlay — no video asset anymore).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Restart the Expo dev server after package installs; reminders don't fire in the web preview (guarded)
- The live methodology is `pushup_strength_methodology.md` (repo root). The older
  `attached_assets/My_Push_Ups_–_Methodological_Specification_*.md` describes the retired
  habit engine and no longer matches the code — keep it only as history.
- Where the strength spec's prose and worked examples disagree, the engine follows the
  examples and the explicit Step 1–4 rules: increments `+R5,+R1,+R2,+R3`; `floor` everywhere
  (so the technical-day examples that silently rounded differ ±1); the beginner "day-1 R5
  taper" is not a rule; re-test window 14 days; the 3-rep floor wins over a sub-3 cap.
