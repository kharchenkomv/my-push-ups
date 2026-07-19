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
- One session per calendar day; habit days set by `habitDaysPerWeek` (5 = weekdays, 6 = all but Sunday, 7 = daily)
- One track only (habit), per the methodology spec in `attached_assets`. A daily session is 5 descending rounds (`ROUND_PERCENTS` = 100/90/85/80/75% of the session target). `dailyTarget` = floor(max×0.5) bounded [2, per-level cap] (`LEVEL_REP_CAP` = 15/12/10/8 for wall/incline/knee/full), stored in AppData and evolved by weekly progression.
- Session type follows a fixed weekly pattern by weekday (`sessionTypeForWeekday`): Standard (100%), Lighter (~85%), Easy (~65%) — Mon Std, Tue Light, Wed Std, Thu Easy, Fri Std, Sat Light, Sun Std. `planForWeekday(dailyTarget, weekday)` yields `{type, target, rounds[5], total}`.
- Weekly progression (`evaluateWeek`, run on load + foreground): +1 to `dailyTarget` after ≥`requiredSessionsForProgress(habitDaysPerWeek)` complete sessions at avg RPE≤7 and zero pain flags that week; −1 if avg RPE≥8, rounds left unfinished, or pain was flagged more than once; hold otherwise. `requiredSessionsForProgress` scales the spec's "6 of 7" bar to the user's chosen `habitDaysPerWeek` (5→4, 6→5, 7→6, via `round(n × 0.85)`) — the spec assumes a fixed 7-day week and doesn't address the 5/6-day settings, so a flat 6 made progression unreachable on those plans (fixed 2026-07-19). Capped at the level cap, floored at 2. Rest is user-set (`settings.restSeconds`, 30–120 s). Max re-test prompted after 21 days recomputes `dailyTarget` from the new max. Level changes only via Settings override.
- Import/export is plain JSON via share sheet / paste; imports are sanitized field-by-field before persisting

## Product

- 4 tabs: Today (today's 5-round exercise card, streak/best/days-since stats), Plan (ramping week schedule + today's prescription + progression explainer), Progress (streak, push-ups-over-time chart, heatmap, milestones, test history), Settings (habit days, goal, level override, reminder, export/import/reset, health screening)
- Onboarding includes a physician warning when any health question is answered yes
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
- The methodology spec lives at `attached_assets/My_Push_Ups_–_Methodological_Specification_1783457021493.md`
  — as of 2026-07-19 it doesn't document the `habitDaysPerWeek` setting or the pain-flag
  progression rule described above; both are real product behavior the spec hasn't caught
  up to yet
