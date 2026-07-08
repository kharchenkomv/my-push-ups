import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import {
  addDays,
  applyStrengthResult,
  createInitialData,
  weekStartKey,
} from "../lib/training";
import type { AppData, SessionEntry } from "../lib/types";

// ---------------------------------------------------------------------------
// Module mocks (must be registered before AppContext is imported).
// ---------------------------------------------------------------------------

interface StorageLog {
  setCalls: { key: string; value: string }[];
  getCalls: string[];
  removeCalls: string[];
}

const storage = new Map<string, string>();
const storageLog: StorageLog = { setCalls: [], getCalls: [], removeCalls: [] };

const asyncStorageMock = {
  async getItem(key: string): Promise<string | null> {
    storageLog.getCalls.push(key);
    await Promise.resolve();
    return storage.has(key) ? (storage.get(key) as string) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await Promise.resolve();
    storageLog.setCalls.push({ key, value });
    storage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await Promise.resolve();
    storageLog.removeCalls.push(key);
    storage.delete(key);
  },
};

type AppStateListener = (state: string) => void;
const appStateListeners = new Set<AppStateListener>();

const appStateMock = {
  currentState: "active",
  addEventListener(_type: string, listener: AppStateListener) {
    appStateListeners.add(listener);
    return {
      remove: () => {
        appStateListeners.delete(listener);
      },
    };
  },
};

mock.module("@react-native-async-storage/async-storage", {
  defaultExport: asyncStorageMock,
});
mock.module("react-native", {
  namedExports: { AppState: appStateMock },
});

type AppContextModule = typeof import("../context/AppContext");
type TestRendererModule = typeof import("react-test-renderer");

let AppProvider: AppContextModule["AppProvider"];
let useApp: AppContextModule["useApp"];
let act: TestRendererModule["act"];
let create: TestRendererModule["create"];

before(async () => {
  const appContext: AppContextModule = await import("../context/AppContext");
  const testRenderer: TestRendererModule = await import("react-test-renderer");
  AppProvider = appContext.AppProvider;
  useApp = appContext.useApp;
  act = testRenderer.act;
  create = testRenderer.create;
});

type Ctx = ReturnType<AppContextModule["useApp"]>;
type Renderer = ReturnType<TestRendererModule["create"]>;

const STORAGE_KEY = "mpu:data:v1";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function Capture({ out }: { out: { current: Ctx | null } }) {
  out.current = useApp();
  return null;
}

async function mountProvider(): Promise<{
  ctx: { current: Ctx | null };
  renderer: Renderer;
}> {
  const ctx: { current: Ctx | null } = { current: null };
  let renderer: Renderer | null = null;
  await act(async () => {
    renderer = create(
      React.createElement(
        AppProvider,
        null,
        React.createElement(Capture, { out: ctx }),
      ),
    );
  });
  // Let the initial AsyncStorage load (and any follow-up weekly evaluation
  // effect + persistence) settle.
  await act(async () => {
    await flush();
  });
  if (!renderer) throw new Error("renderer failed to mount");
  return { ctx, renderer };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Kick off a context action inside act (so React can flush the resulting
// state update), then await the action's promise once act has settled.
// Awaiting the promise *inside* the act callback would deadlock: it only
// resolves after React processes the update, which act flushes afterwards.
async function runAction<T>(action: () => Promise<T>): Promise<T> {
  let pending: Promise<T> | null = null;
  await act(async () => {
    pending = action();
    await flush();
  });
  return pending!;
}

function seedStorage(data: AppData): void {
  storage.set(STORAGE_KEY, JSON.stringify(data));
}

function persisted(): AppData {
  const raw = storage.get(STORAGE_KEY);
  assert.ok(raw, "expected data to be persisted to AsyncStorage");
  return JSON.parse(raw) as AppData;
}

function makeData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    level: 2,
    maxReps: 10,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

function makeSessionInput(
  overrides: Partial<Omit<SessionEntry, "id">> = {},
): Omit<SessionEntry, "id"> {
  return {
    date: "2026-07-06",
    track: "strength",
    level: 2,
    targetReps: 5,
    roundsPlanned: 5,
    roundsCompleted: 5,
    repsPerRound: [5, 5, 5, 5, 5],
    rpe: 6,
    painFlags: [],
    ...overrides,
  };
}

beforeEach(() => {
  storage.clear();
  storageLog.setCalls.length = 0;
  storageLog.getCalls.length = 0;
  storageLog.removeCalls.length = 0;
  appStateListeners.clear();
});

after(() => {
  mock.reset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppContext: completeSession", () => {
  it("applies applyStrengthResult exactly once for a strength session", async () => {
    // streak = 1 and a strong session means one application bumps
    // roundRepsStrength by exactly +1 and resets the streak. A double
    // application would either bump reps twice or leave streak at 1.
    const seed = makeData({
      roundRepsStrength: 5,
      strengthSuccessStreak: 1,
    });
    seedStorage(seed);
    const { ctx, renderer } = await mountProvider();

    const entry = makeSessionInput({ targetReps: 5 });
    const expected = applyStrengthResult(seed, {
      ...entry,
      id: "expected",
    });
    assert.equal(expected.roundRepsStrength, 6); // sanity: strong => +1

    await runAction(() => ctx.current!.completeSession(entry));

    const data = ctx.current!.data!;
    assert.equal(data.sessions.length, 1);
    assert.equal(data.roundRepsStrength, 6);
    assert.equal(data.strengthSuccessStreak, 0);
    assert.equal(data.deloadRemaining, expected.deloadRemaining);

    // Persisted copy matches in-memory state exactly.
    assert.deepEqual(persisted(), data);

    await act(async () => renderer.unmount());
  });

  it("does not apply strength progression for habit sessions", async () => {
    const seed = makeData({
      roundRepsStrength: 5,
      strengthSuccessStreak: 1,
    });
    seedStorage(seed);
    const { ctx, renderer } = await mountProvider();

    await runAction(() =>
      ctx.current!.completeSession(
        makeSessionInput({ track: "habit", targetReps: 4 }),
      ),
    );

    const data = ctx.current!.data!;
    assert.equal(data.sessions.length, 1);
    assert.equal(data.roundRepsStrength, 5);
    assert.equal(data.strengthSuccessStreak, 1);
    assert.deepEqual(persisted(), data);

    await act(async () => renderer.unmount());
  });

  it("records concurrent saves without losing either session", async () => {
    const seed = makeData({
      roundRepsStrength: 5,
      strengthSuccessStreak: 0,
    });
    seedStorage(seed);
    const { ctx, renderer } = await mountProvider();

    await runAction(() =>
      Promise.all([
        ctx.current!.completeSession(makeSessionInput({ rpe: 6 })),
        ctx.current!.completeSession(makeSessionInput({ rpe: 6 })),
      ]),
    );

    const data = ctx.current!.data!;
    assert.equal(data.sessions.length, 2);
    const ids = new Set(data.sessions.map((s) => s.id));
    assert.equal(ids.size, 2, "each saved session gets a distinct id");
    // Two strong sessions in a row: streak 0 -> 1 -> promotion (+1 rep).
    assert.equal(data.roundRepsStrength, 6);
    assert.equal(data.strengthSuccessStreak, 0);
    assert.deepEqual(persisted(), data);

    await act(async () => renderer.unmount());
  });
});

describe("AppContext: weekly habit evaluation on load", () => {
  it("runs evaluateHabitWeek exactly once when opening in a new week", async () => {
    const currentWeek = weekStartKey();
    const prevWeek = addDays(currentWeek, -7);
    // Two habit sessions last week (< 3) forces exactly one -1 adjustment.
    const seed = makeData({
      roundRepsHabit: 6,
      lastHabitWeekEvaluated: prevWeek,
      sessions: [
        {
          id: "h1",
          date: prevWeek,
          track: "habit",
          level: 2,
          targetReps: 4,
          roundsPlanned: 3,
          roundsCompleted: 3,
          repsPerRound: [4, 4, 4],
          rpe: 5,
          painFlags: [],
        },
        {
          id: "h2",
          date: addDays(prevWeek, 2),
          track: "habit",
          level: 2,
          targetReps: 4,
          roundsPlanned: 3,
          roundsCompleted: 3,
          repsPerRound: [4, 4, 4],
          rpe: 5,
          painFlags: [],
        },
      ],
    });
    seedStorage(seed);

    const { ctx, renderer } = await mountProvider();

    const data = ctx.current!.data!;
    assert.equal(data.roundRepsHabit, 5, "adjusted down exactly once");
    assert.equal(data.lastHabitWeekEvaluated, currentWeek);
    assert.deepEqual(persisted(), data);

    // Re-entering foreground in the same week must not re-adjust.
    await act(async () => {
      for (const listener of appStateListeners) listener("active");
      await flush();
    });
    assert.equal(ctx.current!.data!.roundRepsHabit, 5);
    assert.equal(ctx.current!.data!.lastHabitWeekEvaluated, currentWeek);

    await act(async () => renderer.unmount());
  });

  it("does not touch state or storage when the week is already evaluated", async () => {
    const seed = makeData({ roundRepsHabit: 6 });
    seedStorage(seed);
    const before = storage.get(STORAGE_KEY);

    const { ctx, renderer } = await mountProvider();

    assert.deepEqual(ctx.current!.data, seed);
    assert.equal(storageLog.setCalls.length, 0, "no writes on a clean load");
    assert.equal(storage.get(STORAGE_KEY), before);

    await act(async () => renderer.unmount());
  });

  it("evaluates once when the week rolls over while the app is running", async (t) => {
    const seed = makeData({ roundRepsHabit: 6 });
    seedStorage(seed);
    const { ctx, renderer } = await mountProvider();
    assert.equal(ctx.current!.data!.lastHabitWeekEvaluated, weekStartKey());

    // Jump the clock forward one week, then simulate returning to foreground.
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
    t.mock.timers.setTime(Date.now() + 7 * 86400000);
    const newWeek = weekStartKey();
    assert.notEqual(newWeek, seed.lastHabitWeekEvaluated);

    const writesBefore = storageLog.setCalls.length;
    await act(async () => {
      for (const listener of appStateListeners) listener("active");
      await flush();
    });

    const data = ctx.current!.data!;
    assert.equal(data.lastHabitWeekEvaluated, newWeek);
    // No habit sessions last week => reps unchanged, only the marker moves.
    assert.equal(data.roundRepsHabit, 6);
    assert.equal(
      storageLog.setCalls.length,
      writesBefore + 1,
      "exactly one persistence write for the rollover",
    );

    // A second foreground event in the same (new) week is a no-op.
    await act(async () => {
      for (const listener of appStateListeners) listener("active");
      await flush();
    });
    assert.equal(storageLog.setCalls.length, writesBefore + 1);
    assert.deepEqual(persisted(), ctx.current!.data);

    await act(async () => renderer.unmount());
    t.mock.timers.reset();
  });
});

describe("AppContext: persistence round-trip", () => {
  it("reloads persisted state without mutation", async () => {
    const seed = makeData({ roundRepsStrength: 5, strengthSuccessStreak: 0 });
    seedStorage(seed);

    const first = await mountProvider();
    await runAction(() =>
      first.ctx.current!.completeSession(makeSessionInput({ rpe: 8 })),
    );
    const afterSave = first.ctx.current!.data!;
    await act(async () => first.renderer.unmount());

    // Fresh mount in the same week must load the identical state.
    const second = await mountProvider();
    assert.deepEqual(second.ctx.current!.data, afterSave);

    // And exporting reproduces the same data.
    assert.deepEqual(
      JSON.parse(second.ctx.current!.exportJson()),
      afterSave,
    );
    await act(async () => second.renderer.unmount());
  });

  it("migrates legacy reminder configs without days arrays", async () => {
    const seed = makeData();
    const legacy = JSON.parse(JSON.stringify(seed)) as Record<string, any>;
    delete legacy.settings.habitReminder.days;
    delete legacy.settings.strengthReminder.days;
    storage.set(STORAGE_KEY, JSON.stringify(legacy));

    const { ctx, renderer } = await mountProvider();

    const settings = ctx.current!.data!.settings;
    assert.deepEqual(settings.habitReminder.days, [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(settings.strengthReminder.days, seed.settings.strengthDays);

    await act(async () => renderer.unmount());
  });

  it("resetAll clears both state and storage", async () => {
    seedStorage(makeData());
    const { ctx, renderer } = await mountProvider();
    assert.ok(ctx.current!.data);

    await runAction(() => ctx.current!.resetAll());

    assert.equal(ctx.current!.data, null);
    assert.equal(storage.has(STORAGE_KEY), false);

    await act(async () => renderer.unmount());
  });
});
