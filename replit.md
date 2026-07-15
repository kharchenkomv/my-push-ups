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
- One track only (habit). A daily session is 5 rounds (`SESSION_ROUNDS`) with 60 s rest between rounds. Per-round reps ramp deterministically: base = floor(max×0.4) clamped 3–15, then +1 every 3 days (`RAMP_STEP_DAYS`) since the last max test, capped at 15 and at the tested max. A max re-test (prompted after 21 days) resets the ramp from a new base. No weekly RPE adjustment, no strength track, no auto level-up (level is changed only via Settings override).
- The whole plan is derived from the latest max test + calendar date — nothing rep-related is stored in AppData; `sessionRoundReps(data, date)` computes it on the fly, so the Plan tab shows the climbing day-by-day schedule.
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
