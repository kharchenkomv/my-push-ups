# My Push Ups — iOS Technical Description

Reviewed 2026-07-10 against Expo SDK 54 / React Native 0.81.5 (new architecture enabled).

## What the app is

Offline, no-login push-up trainer. Single Expo app (`artifacts/my-push-ups`) in a pnpm
monorepo; no backend, no env vars, no secrets. All state lives in AsyncStorage under the
key `mpu:data:v1`. The training engine is pure functions in `lib/training.ts` (41 tests).

## iOS-specific implementation (already in place)

- **Navigation**: expo-router. On iOS 26+ with Liquid Glass available
  (`isLiquidGlassAvailable()` in `app/(tabs)/_layout.tsx`), the tab bar renders as native
  tabs via `expo-router/unstable-native-tabs` with SF Symbol icons; otherwise a classic
  JS tab bar with a `BlurView` background and `SymbolView` icons. Android/web fall back
  to Feather icons.
- **Workout screen** (`app/workout.tsx`): presented as `fullScreenModal` with
  `gestureEnabled: false` so a swipe can't abandon a session.
- **Safe areas**: `react-native-safe-area-context` insets applied per-screen
  (`insets.top + 12` / `insets.bottom + 12–16`; web uses fixed paddings).
- **Haptics**: `expo-haptics` on round/rest transitions, gated by the user's
  `settings.haptics` toggle and disabled on web.
- **Sound**: `expo-audio` plays bundled `assets/sounds/beep.wav` / `chime.wav` during
  rest countdown, with `setAudioModeAsync({ playsInSilentMode: true })` so cues fire
  with the ring/silent switch on. Gated by `settings.sound`.
- **Notifications** (`lib/notifications.ts`): local weekly reminders only, no push.
  `expo-notifications` is imported dynamically and web-guarded; permission is requested
  lazily when the user enables a reminder. Weekday mapping: app stores 0=Sunday, Expo
  triggers use 1=Sunday, converted with `weekday + 1`.
- **Export/import**: `Share.share()` (native iOS share sheet) exports plain JSON;
  import is paste-a-string, sanitized field-by-field in `lib/training.ts`.
- **Appearance**: `userInterfaceStyle: "automatic"` with full dark-mode palette
  (coral `#E44F3A` on off-white `#F6F4EF` / dark equivalents). Portrait only, iPhone
  only (`supportsTablet: false`).
- **App icon**: `assets/images/icon.png` is 2048×2048 with no alpha channel — meets
  App Store requirements.
- **Launch animation**: on cold start (native only, skipped on web),
  `components/LaunchAnimation.tsx` plays `assets/videos/launch.mp4` (5.8 s, muted,
  `expo-video`) as a full-screen overlay above the app. It fades out at ~5.1 s —
  before the video's own fade-to-black tail — and a tap anywhere skips it. The native
  splash background `#1E3A8A` matches the video's opening frame, so
  splash → video → app is seamless.

## How to run on iOS

```bash
cd artifacts/my-push-ups

# Simulator / device via Expo Go (fastest; local notifications work in Expo Go on iOS)
pnpm exec expo start            # then press i, or scan the QR code

# Native dev build (required for the Liquid Glass native tabs path)
pnpm exec expo run:ios          # requires a bundleIdentifier — see gaps below
```

Note: the package's `dev` script is Replit-specific — don't use it locally. The lockfile
pins some native binaries to Linux (see root `CLAUDE.md`); a clean install on macOS needs
the documented lightningcss re-vendoring for the *web* preview only — native iOS builds
are unaffected.

## Known gaps before a device build / App Store submission

1. **Splash image is the raw app icon** in `contain` mode. The navy
   `splash.backgroundColor` (`#1E3A8A`) intentionally matches the launch video's
   opening frame — don't change it without re-checking the video handoff.
2. **Interactive release steps still pending** (need the owner's logins, mirroring the
   Habit-Visualizer release setup, Apple ID `kharchenko.mikhail@icloud.com`, EAS remote
   credentials): `eas login` + first `eas build --platform ios --profile production`
   (registers the bundle ID and links an EAS `projectId` into `app.json`), then create
   the app record in App Store Connect and add its numeric `ascAppId` to `eas.json`'s
   submit block.

Fixed 2026-07-10 (previously listed as gaps):

- **Bundle identifier set**: `com.mikhailkharchenko.mytrainer` (+ `buildNumber: "1"`,
  `ITSAppUsesNonExemptEncryption: false`) in `app.json`; `eas.json` created with the
  same remote-credentials production profile as the sibling tracker app. Changeable
  until the first App Store upload, frozen after.

- **Rest timer** is now anchored to a `Date.now()` deadline (`restEndsAt` in
  `app/workout.tsx`), so backgrounding or screen lock no longer stalls the countdown;
  `expo-keep-awake` (via `activateKeepAwakeAsync`/`deactivateKeepAwake`, native-only —
  the web Wake Lock API throws in embedded contexts) keeps the display on during workouts.
- **Unused native modules removed**: `expo-location` and `expo-image-picker` are out of
  `package.json` — no orphaned Location/Photos API references in the binary.
- **Foreground notification handler**: `initNotificationHandler()` in
  `lib/notifications.ts` (called from the root layout) shows reminder banners while the
  app is open.
- **Replit leftover removed**: the `expo-router` plugin no longer sets
  `origin: "https://replit.com/"`.

## Permissions summary (Info.plist)

| Capability | Needed? | Notes |
|---|---|---|
| Notifications | Yes (runtime permission, no plist key) | Requested lazily on reminder enable |
| Location | No | `expo-location` removed 2026-07-10 |
| Camera / Photos | No | `expo-image-picker` removed 2026-07-10 |
| Network | None used | Fully offline; no ATS concerns |
| Background modes | None | Rest timer uses wall-clock deadlines, no background execution needed |
