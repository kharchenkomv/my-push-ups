# My Push Ups

An offline, no-login push-up trainer mobile app: a tiny daily habit set plus three weekly strength sessions, auto-progressing toward a user's goal (e.g. 100 push-ups).

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
- `artifacts/my-push-ups/app/workout.tsx` — big-circle workout flow (`track` param: `habit` | `strength` | `maxtest`)
- `artifacts/my-push-ups/app/(tabs)/` — Today / Plan / Progress / Settings screens; `_layout.tsx` holds the onboarding redirect gate
- `artifacts/my-push-ups/lib/notifications.ts` — weekly local reminders (dynamic import, web-guarded)

## Architecture decisions

- All training logic is pure functions in `lib/training.ts` so it's testable and UI-independent
- One session per calendar day; strength days (default Mon/Wed/Fri) override habit days
- Progression: +1 rep after 2 consecutive complete sessions at RPE≤7; −1 on RPE≥9 or 2+ failed rounds; 3-session deload when hitting the level cap; re-test prompt after 21 days
- Habit reps = clamp(floor(max×0.4), 3, 15); strength per-round = round(max×2/3/5) clamped to level cap (Full extends to 40 when max ≥ 20)
- Import/export is plain JSON via share sheet / paste; imports are sanitized field-by-field before persisting

## Product

- 4 tabs: Today (action card, week strip, goal progress), Plan (schedule + prescription), Progress (streak, heatmap, milestones, test history), Settings (rest 60–150s, days, goal, level override, reminders, export/import/reset, health screening)
- Onboarding includes a physician warning when any health question is answered yes
- Coral #E44F3A on off-white #F6F4EF, full dark mode, haptics on round/rest transitions

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Restart the Expo workflow via the workflow tool after package installs; reminders don't fire in the web preview (guarded)
- The spec document lives at `attached_assets/My_Push_Ups_–_Methodological_Specification_1783457021493.md`
