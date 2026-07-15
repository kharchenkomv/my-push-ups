# My Push Ups

An offline, no-login push-up trainer mobile app: a tiny daily habit set, auto-progressing toward a user's goal (e.g. 100 push-ups). (The former strength track was removed 2026-07-10 — habit-only now.)

## Run & Operate

- `pnpm --filter @workspace/my-push-ups run dev` — run the Expo app (use the Replit workflow, never `npx expo start` directly)
- `pnpm --filter @workspace/my-push-ups run typecheck` — typecheck the mobile app
- `pnpm run typecheck` — full typecheck across all packages
- No env vars or database required — the app is fully offline (AsyncStorage only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54 + expo-router (tabs), React Native
- Storage: @react-native-async-storage/async-storage (key `mpu:data:v1`)
- Extras: react-native-svg (rest ring), expo-haptics, expo-notifications (reminders), Inter fonts
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
- Weekly progression (`evaluateWeek`, run on load + foreground): +1 to `dailyTarget` after ≥6 complete sessions at avg RPE≤7; −1 if avg RPE≥8 or rounds left unfinished; hold otherwise. Capped at the level cap, floored at 2. Rest is user-set (`settings.restSeconds`, 30–120 s). Max re-test prompted after 21 days recomputes `dailyTarget` from the new max. Level changes only via Settings override.
- Import/export is plain JSON via share sheet / paste; imports are sanitized field-by-field before persisting

## Product

- 4 tabs: Today (today's 5-round exercise card, streak/best/days-since stats), Plan (ramping week schedule + today's prescription + progression explainer), Progress (streak, push-ups-over-time chart, heatmap, milestones, test history), Settings (habit days, goal, level override, reminder, export/import/reset, health screening)
- Onboarding includes a physician warning when any health question is answered yes
- Coral #E44F3A on off-white #F6F4EF, full dark mode, haptics on round/rest transitions

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Restart the Expo workflow via the workflow tool after package installs; reminders don't fire in the web preview (guarded)
- The spec document lives at `attached_assets/My_Push_Ups_–_Methodological_Specification_1783457021493.md`
