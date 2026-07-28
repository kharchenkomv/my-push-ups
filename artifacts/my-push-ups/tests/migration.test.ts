import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { planFor, sanitizeImport } from "../lib/state";
import { getExercise } from "../lib/exercises";
import type { AppData } from "../lib/types";

// ---------------------------------------------------------------------------
// Migration is the one step of this refactor that can destroy real user data,
// so these fixtures are hand-written literals of what is ACTUALLY on disk in
// shipped builds. They are deliberately NOT generated from createInitialData —
// a generated fixture would silently track any future change to the model and
// stop testing the thing that matters.
// ---------------------------------------------------------------------------

/** The v1 shape: single exercise, everything top-level, `reps`-named fields. */
function v1Blob(overrides: Record<string, unknown> = {}) {
  return {
    onboardingComplete: true,
    health: { cardio: false, joints: true, pain: false, acknowledged: true },
    settings: {
      habitDaysPerWeek: 6,
      restSeconds: 120,
      goalReps: 30,
      sound: false,
      habitReminder: { enabled: true, hour: 8, minute: 30, days: [1, 3, 5] },
    },
    maxTests: [
      { date: "2026-06-01", reps: 18 },
      { date: "2026-06-15", reps: 25 },
    ],
    sessions: [
      {
        id: "s1",
        date: "2026-06-16",
        targetReps: 15,
        roundsPlanned: 5,
        roundsCompleted: 5,
        repsPerRound: [15, 15, 13, 13, 12],
        rpe: 7,
        painFlags: ["wrist"],
      },
      {
        id: "s2",
        date: "2026-06-17",
        targetReps: 15,
        roundsPlanned: 5,
        roundsCompleted: 4,
        repsPerRound: [15, 15, 13, 10],
        rpe: null,
        painFlags: [],
      },
    ],
    dayNumber: 5,
    needsMaxTest: false,
    ...overrides,
  };
}

/** The habit-era (v0) shape: same top level, plus fields that no longer exist. */
function v0Blob() {
  return {
    onboardingComplete: true,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    settings: { habitDaysPerWeek: 7, restSeconds: 60, goalReps: 50, sound: true },
    level: 3,
    dailyTarget: 24,
    lastWeekEvaluated: "2026-05-30",
    maxTests: [{ date: "2026-05-20", reps: 12 }],
    sessions: [
      {
        id: "old1",
        date: "2026-05-21",
        targetReps: 8,
        roundsPlanned: 5,
        roundsCompleted: 5,
        repsPerRound: [8, 8, 7, 7, 6],
        rpe: 5,
        painFlags: [],
      },
    ],
    // no dayNumber — must be synthesized from session count
  };
}

const px = (d: AppData) => d.exercises.pushups;

describe("migration: v1 → v2", () => {
  it("folds the single top-level track into exercises.pushups", () => {
    const out = sanitizeImport(v1Blob());
    assert.ok(out);
    assert.equal(out.version, 2);
    assert.equal(px(out).enabled, true);
    assert.equal(px(out).dayNumber, 5);
    assert.equal(px(out).needsMaxTest, false);
    assert.equal(px(out).maxTests.length, 2);
    assert.equal(px(out).sessions.length, 2);
  });

  it("renames reps → value on max tests", () => {
    const out = sanitizeImport(v1Blob())!;
    assert.deepEqual(px(out).maxTests, [
      { date: "2026-06-01", value: 18 },
      { date: "2026-06-15", value: 25 },
    ]);
  });

  it("renames targetReps/repsPerRound → targetValue/valuePerRound", () => {
    const out = sanitizeImport(v1Blob())!;
    const s = px(out).sessions[0]!;
    assert.equal(s.targetValue, 15);
    assert.deepEqual(s.valuePerRound, [15, 15, 13, 13, 12]);
    assert.equal(s.rpe, 7);
    assert.deepEqual(s.painFlags, ["wrist"]);
    // The old spellings must not survive onto the new record.
    assert.equal((s as unknown as Record<string, unknown>).targetReps, undefined);
    assert.equal((s as unknown as Record<string, unknown>).repsPerRound, undefined);
  });

  it("splits settings into global and per-exercise", () => {
    const out = sanitizeImport(v1Blob())!;
    // Global
    assert.equal(out.settings.habitDaysPerWeek, 6);
    assert.equal(out.settings.sound, false);
    assert.deepEqual(out.settings.habitReminder.days, [1, 3, 5]);
    assert.equal(out.settings.habitReminder.hour, 8);
    // Per-exercise
    assert.equal(px(out).settings.restSeconds, 120);
    // restSeconds must no longer sit on the global object, and the retired
    // goal field must not survive anywhere.
    const g = out.settings as unknown as Record<string, unknown>;
    assert.equal(g.restSeconds, undefined);
    assert.equal(g.goalReps, undefined);
    const es = px(out).settings as unknown as Record<string, unknown>;
    assert.equal(es.goalValue, undefined);
    assert.equal(es.goalReps, undefined);
  });

  it("preserves health answers", () => {
    const out = sanitizeImport(v1Blob())!;
    assert.deepEqual(out.health, {
      cardio: false,
      joints: true,
      pain: false,
      acknowledged: true,
    });
  });

  // The guarantee the whole refactor rests on: a user mid-cycle must open the
  // app after upgrading and see the exact same numbers as before.
  it("PLAN CONTINUITY: the prescription is byte-identical across migration", () => {
    const out = sanitizeImport(v1Blob())!;
    const plan = planFor(getExercise("pushups"), px(out));
    // max 25 (latest test), dayNumber 5 → the intermediate worked example.
    assert.deepEqual(plan.rounds, [16, 16, 14, 13, 13]);
    assert.equal(plan.microPos, 5);
    assert.equal(plan.type, "progressive");
  });
});

describe("migration: habit-era (v0) → v2", () => {
  it("drops dead fields and keeps history", () => {
    const out = sanitizeImport(v0Blob());
    assert.ok(out);
    assert.equal(px(out).maxTests.length, 1);
    assert.equal(px(out).maxTests[0]!.value, 12);
    assert.equal(px(out).sessions.length, 1);
    const o = out as unknown as Record<string, unknown>;
    assert.equal(o.level, undefined);
    assert.equal(o.dailyTarget, undefined);
    assert.equal(o.lastWeekEvaluated, undefined);
  });

  it("synthesizes dayNumber from the session count", () => {
    const out = sanitizeImport(v0Blob())!;
    // 1 session logged → next session is cycle day 2.
    assert.equal(px(out).dayNumber, 2);
  });
});

describe("v2 round-tripping", () => {
  it("is idempotent — re-importing its own output changes nothing", () => {
    const once = sanitizeImport(v1Blob())!;
    const twice = sanitizeImport(JSON.parse(JSON.stringify(once)))!;
    assert.deepEqual(twice, once);
  });

  it("survives an export → import cycle", () => {
    const migrated = sanitizeImport(v1Blob())!;
    const exported = JSON.stringify(migrated, null, 2);
    const reimported = sanitizeImport(JSON.parse(exported))!;
    assert.deepEqual(reimported, migrated);
  });

  it("seeds any registered exercise missing from the blob", () => {
    const out = sanitizeImport(v1Blob())!;
    const stripped = JSON.parse(JSON.stringify(out));
    delete stripped.exercises.pushups;
    stripped.exercises.somethingElse = { enabled: true, maxTests: [] };
    // No calibrated exercise remains → unusable.
    assert.equal(sanitizeImport(stripped), null);
  });

  it("drops unknown exercise ids but keeps registered ones", () => {
    const out = sanitizeImport(v1Blob())!;
    const withJunk = JSON.parse(JSON.stringify(out));
    withJunk.exercises.plank = { enabled: true, maxTests: [{ date: "2026-06-01", value: 60 }] };
    const cleaned = sanitizeImport(withJunk)!;
    assert.equal((cleaned.exercises as Record<string, unknown>).plank, undefined);
    assert.equal(px(cleaned).maxTests.length, 2);
  });
});

describe("rejection rules", () => {
  it("rejects non-objects and junk", () => {
    assert.equal(sanitizeImport(null), null);
    assert.equal(sanitizeImport("nope"), null);
    assert.equal(sanitizeImport(42), null);
    assert.equal(sanitizeImport({}), null);
  });

  it("rejects a blob where nothing is calibrated", () => {
    assert.equal(sanitizeImport(v1Blob({ maxTests: [] })), null);
  });

  it("REGRESSION: never rejects what the v1 sanitizer accepted", () => {
    // The old sanitizer's acceptance rule was "maxTests and sessions are arrays
    // and at least one max test is valid". Anything meeting it must still load.
    assert.ok(sanitizeImport(v1Blob()));
    assert.ok(sanitizeImport(v1Blob({ sessions: [] })));
    assert.ok(sanitizeImport(v0Blob()));
    // Malformed entries are filtered, not fatal.
    const withBadRows = v1Blob({
      maxTests: [{ date: "nope", reps: 5 }, { date: "2026-06-01", reps: 18 }],
      sessions: [{ garbage: true }],
    });
    const out = sanitizeImport(withBadRows)!;
    assert.ok(out);
    assert.equal(px(out).maxTests.length, 1);
    assert.equal(px(out).sessions.length, 0);
  });

  it("clamps out-of-range values rather than failing", () => {
    const out = sanitizeImport(
      v1Blob({
        maxTests: [{ date: "2026-06-01", reps: 5000 }],
        settings: { restSeconds: 9999, goalReps: -4, habitDaysPerWeek: 99 },
      }),
    )!;
    assert.equal(px(out).maxTests[0]!.value, 999);
    assert.ok(px(out).settings.restSeconds <= 180);
    assert.equal(out.settings.habitDaysPerWeek, 7);
  });
});
