import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceDayNumber,
  createInitialData,
  microPosOf,
  planForDay,
  sanitizeImport,
  MICROCYCLE_DAYS,
} from "../lib/training";
import type { AppData } from "../lib/types";

function freshData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    maxReps: 20,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

describe("microcycle simulation", () => {
  it("completing sessions walks the 7-day cycle and repeats it", () => {
    let day = 1;
    const positions: number[] = [];
    for (let i = 0; i < 9; i++) {
      positions.push(microPosOf(day));
      day = advanceDayNumber(day); // completing a session advances the cycle
    }
    // 1..7 then wraps back to 1, 2
    assert.deepEqual(positions, [1, 2, 3, 4, 5, 6, 7, 1, 2]);
  });

  it("a skipped day repeats the same prescription (no advance)", () => {
    const max = 20;
    const dayNumber = 3;
    const planned = planForDay(max, dayNumber);
    // Skip: dayNumber is unchanged, so the next training day is identical.
    const afterSkip = planForDay(max, dayNumber);
    assert.deepEqual(afterSkip.rounds, planned.rounds);
    // Only completing it advances the cycle.
    assert.equal(microPosOf(advanceDayNumber(dayNumber)), 4);
  });

  it("volume rises within a cycle then eases on the hold/technical days", () => {
    const max = 25;
    const totals = Array.from({ length: MICROCYCLE_DAYS }, (_, i) =>
      planForDay(max, i + 1).total,
    );
    // Progressive days 1..5 are non-decreasing.
    for (let i = 1; i < 5; i++) assert.ok(totals[i]! >= totals[i - 1]!);
    // Hold (day 6) equals day 5; technical (day 7) is the lightest of the week.
    assert.equal(totals[5], totals[4]);
    assert.ok(totals[6]! < totals[5]!);
    assert.equal(Math.min(...totals), totals[6]);
  });

  it("a higher re-tested max lifts every round target", () => {
    const before = planForDay(20, 1).rounds;
    const after = planForDay(26, 1).rounds;
    for (let i = 0; i < before.length; i++) {
      assert.ok(after[i]! >= before[i]!);
    }
    assert.ok(after.reduce((a, b) => a + b, 0) > before.reduce((a, b) => a + b, 0));
  });
});

describe("import of malformed backups", () => {
  const validBackup = () => ({
    maxTests: [{ date: "2026-06-01", reps: 20 }],
    sessions: [
      {
        id: "x1",
        date: "2026-06-02",
        targetReps: 15,
        roundsPlanned: 5,
        roundsCompleted: 5,
        repsPerRound: [15, 15, 13, 13, 12],
        rpe: 6,
        painFlags: [],
      },
    ],
    dayNumber: 3,
    settings: {
      habitDaysPerWeek: 7,
      restSeconds: 90,
      goalReps: 50,
      sound: true,
      haptics: true,
    },
  });

  it("accepts a valid backup and preserves state", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    assert.equal(out.dayNumber, 3);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.settings.restSeconds, 90);
    // Levels are gone from the shape entirely.
    assert.equal("level" in out, false);
    assert.equal("level" in out.maxTests[0]!, false);
    assert.equal("level" in out.sessions[0]!, false);
  });

  it("keeps a valid elbow pain flag and drops unknown ones", () => {
    const backup = validBackup();
    const out = sanitizeImport({
      ...backup,
      sessions: [{ ...backup.sessions[0], painFlags: ["elbow", "made-up"] }],
    });
    assert.ok(out);
    assert.deepEqual(out.sessions[0]?.painFlags, ["elbow"]);
  });

  it("migrates a habit-era backup, dropping level / dailyTarget / weekly fields", () => {
    const legacy = {
      level: 2,
      maxTests: [{ date: "2026-06-01", level: 2, reps: 20 }],
      sessions: [
        {
          id: "st1",
          date: "2026-06-02",
          level: 2,
          targetReps: 5,
          roundsPlanned: 5,
          roundsCompleted: 5,
          repsPerRound: [5, 5, 5, 5, 5],
          rpe: 6,
          painFlags: [],
        },
      ],
      dailyTarget: 10,
      lastWeekEvaluated: "2026-06-01",
      settings: {
        habitDaysPerWeek: 7,
        goalReps: 50,
        sound: true,
        haptics: true,
      },
    };
    const out = sanitizeImport(legacy);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal("level" in out, false);
    assert.equal("dailyTarget" in out, false);
    assert.equal("lastWeekEvaluated" in out, false);
    assert.equal("level" in out.sessions[0]!, false);
    assert.equal("level" in out.maxTests[0]!, false);
    // No stored dayNumber: synthesize from completed-session count (1 + 1).
    assert.equal(out.dayNumber, 2);
    // rest gets the default when absent
    assert.equal(out.settings.restSeconds, 90);
  });

  it("rejects non-objects, empty payloads, and missing arrays", () => {
    assert.equal(sanitizeImport(null), null);
    assert.equal(sanitizeImport({}), null);
    assert.equal(sanitizeImport({ ...validBackup(), maxTests: [] }), null);
    assert.equal(
      sanitizeImport({ ...validBackup(), maxTests: undefined }),
      null,
    );
  });

  it("clamps rest above the 3-minute ceiling", () => {
    const over = sanitizeImport({
      ...validBackup(),
      settings: { ...validBackup().settings, restSeconds: 9999 },
    });
    assert.ok(over);
    assert.equal(over.settings.restSeconds, 180); // capped at 3 min
  });

  it("filters malformed sessions but keeps valid ones", () => {
    const backup = validBackup();
    (backup.sessions as unknown[]).push({ date: "2026-06-03" }, null, "garbage");
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.sessions[0]?.id, "x1");
  });

  it("defaults dayNumber to 1 for a backup with no sessions", () => {
    const backup = validBackup() as Record<string, unknown>;
    delete backup.dayNumber;
    backup.sessions = [];
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.dayNumber, 1);
  });
});
