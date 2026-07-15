import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { createInitialData } from "../lib/training";
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
    level: 2,
    targetReps: 4,
    roundsPlanned: 5,
    roundsCompleted: 5,
    repsPerRound: [4, 4, 4, 4, 4],
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
  it("appends the session and persists it", async () => {
    const seed = makeData();
    seedStorage(seed);
    const { ctx, renderer } = await mountProvider();

    await runAction(() => ctx.current!.completeSession(makeSessionInput()));

    const data = ctx.current!.data!;
    assert.equal(data.sessions.length, 1);
    assert.equal(data.sessions[0]?.targetReps, 4);

    // Persisted copy matches in-memory state exactly.
    assert.deepEqual(persisted(), data);

    await act(async () => renderer.unmount());
  });

  it("records concurrent saves without losing either session", async () => {
    seedStorage(makeData());
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
    assert.deepEqual(persisted(), data);

    await act(async () => renderer.unmount());
  });
});

describe("AppContext: recordMaxTest", () => {
  it("appends a max test and clears the needs-test flag", async () => {
    seedStorage(makeData({ needsMaxTest: true }));
    const { ctx, renderer } = await mountProvider();

    await runAction(() => ctx.current!.recordMaxTest(20));

    const data = ctx.current!.data!;
    assert.equal(data.maxTests.length, 2);
    assert.equal(data.maxTests[1]?.reps, 20);
    assert.equal(data.needsMaxTest, false);
    assert.deepEqual(persisted(), data);

    await act(async () => renderer.unmount());
  });
});

describe("AppContext: load", () => {
  it("does not write when loading data already in the current shape", async () => {
    const seed = makeData();
    seedStorage(seed);
    const before = storage.get(STORAGE_KEY);

    const { ctx, renderer } = await mountProvider();

    assert.deepEqual(ctx.current!.data, seed);
    assert.equal(storageLog.setCalls.length, 0, "no writes on a clean load");
    assert.equal(storage.get(STORAGE_KEY), before);

    await act(async () => renderer.unmount());
  });
});

describe("AppContext: persistence round-trip", () => {
  it("reloads persisted state without mutation", async () => {
    seedStorage(makeData());

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

  it("migrates stored data from the strength-track era", async () => {
    // Shape written by app versions that still had the strength track.
    const seed = makeData();
    const legacy = JSON.parse(JSON.stringify(seed)) as Record<string, any>;
    legacy.roundRepsStrength = 5;
    legacy.strengthSuccessStreak = 1;
    legacy.deloadRemaining = 0;
    legacy.settings.restSeconds = 120;
    legacy.settings.strengthDays = [1, 3, 5];
    legacy.settings.strengthReminder = {
      enabled: true,
      hour: 18,
      minute: 0,
      days: [1, 3, 5],
    };
    delete legacy.settings.habitReminder.days;
    legacy.sessions = [
      {
        id: "st1",
        date: "2026-07-01",
        track: "strength",
        level: 2,
        targetReps: 5,
        roundsPlanned: 5,
        roundsCompleted: 5,
        repsPerRound: [5, 5, 5, 5, 5],
        rpe: 6,
        painFlags: [],
      },
    ];
    storage.set(STORAGE_KEY, JSON.stringify(legacy));

    const { ctx, renderer } = await mountProvider();

    const data = ctx.current!.data!;
    // Strength-era session survives as plain history.
    assert.equal(data.sessions.length, 1);
    assert.equal("track" in data.sessions[0]!, false);
    // Strength fields are gone.
    assert.equal("roundRepsStrength" in data, false);
    assert.equal("roundRepsHabit" in data, false);
    assert.equal("strengthDays" in data.settings, false);
    assert.equal("strengthReminder" in data.settings, false);
    // Pre-`days` reminder config gets the default days.
    assert.deepEqual(data.settings.habitReminder.days, [0, 1, 2, 3, 4, 5, 6]);

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
