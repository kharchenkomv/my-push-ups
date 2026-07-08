---
name: Testing React Native context providers under node:test
description: How to unit-test Expo/RN React context providers with tsx + node:test module mocks; pitfalls that cause hangs.
---

The mobile app's context providers can be tested without Jest/jsdom by mounting them with `react-test-renderer` under the node test runner.

**Recipe:**
- Run with `node --experimental-test-module-mocks --import tsx --test` (flag is already in the app's `test` script).
- `mock.module("react-native", { namedExports: { AppState: ... } })` and `mock.module("@react-native-async-storage/async-storage", { defaultExport: ... })` BEFORE importing the provider — import the provider dynamically inside a `before()` hook.
- Set `globalThis.IS_REACT_ACT_ENVIRONMENT = true` or every `act` call warns/misbehaves.
- Test files compile to CJS (no `"type": "module"`), so top-level `await import(...)` fails — use the `before()` hook instead.

**Deadlock pitfall:** provider actions whose returned promise resolves only after React processes the state update (e.g. a `mutate` that resolves inside a `setState` updater) must NOT be awaited inside the `act` callback — act flushes updates only after its callback returns, so awaiting inside deadlocks and the test runner reports "Promise resolution is still pending but the event loop has already resolved". Start the promise inside `act`, flush timers, then await it after `act` completes.

**Why:** first attempt hung the whole test file for the full timeout with no useful error; this cost several debug cycles.

**How to apply:** any new tests for AppContext-like providers (or other RN-module-importing code) in `artifacts/my-push-ups/tests/` should copy the harness in `app-context.test.ts`. Also wrap `renderer.unmount()` in `act` to avoid stray warnings.
