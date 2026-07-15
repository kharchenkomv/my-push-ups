import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  baseRoundReps,
  createInitialData,
  sanitizeImport,
  sessionRoundReps,
  SESSION_ROUNDS,
} from "../lib/training";
import type { AppData } from "../lib/types";

function freshData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    level: 2,
    maxReps: 20,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

const TEST_DAY = "2026-06-01";

describe("3-week ramp simulation", () => {
  it("climbs 1 rep per round every 3 days, capped at 15", () => {
    // Max test of 20 on day 0 -> base 8, cap min(15,20)=15.
    const data = freshData({
      maxTests: [{ date: TEST_DAY, level: 2, reps: 20 }],
    });
    const perDay: number[] = [];
    for (let d = 0; d < 21; d++) {
      perDay.push(sessionRoundReps(data, addDays(TEST_DAY, d)));
    }
    // 8,8,8, 9,9,9, 10,10,10, 11,11,11, 12,12,12, 13,13,13, 14,14,14
    assert.deepEqual(perDay, [
      8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 13, 14, 14,
      14,
    ]);
  });

  it("weekly volume increase stays modest (~1 rep/round/3 days)", () => {
    const data = freshData({
      maxTests: [{ date: TEST_DAY, level: 2, reps: 20 }],
    });
    const week1 = SESSION_ROUNDS * sessionRoundReps(data, addDays(TEST_DAY, 0));
    const week2 = SESSION_ROUNDS * sessionRoundReps(data, addDays(TEST_DAY, 7));
    // day 0 -> 8/round (40 total); day 7 -> 10/round (50 total): +25% over a
    // full week, i.e. well under +10%/day.
    assert.equal(week1, 40);
    assert.equal(week2, 50);
  });

  it("a lower-capacity user is capped at their tested max", () => {
    const data = freshData({
      maxTests: [{ date: TEST_DAY, level: 1, reps: 8 }],
      level: 1,
    });
    const base = baseRoundReps(8); // 3
    assert.equal(sessionRoundReps(data, TEST_DAY), base);
    // cap = min(15, 8) = 8; far into the ramp it never exceeds 8
    assert.equal(sessionRoundReps(data, addDays(TEST_DAY, 60)), 8);
  });
});

describe("import of malformed backups", () => {
  const validBackup = () => ({
    level: 2,
    maxTests: [{ date: "2026-06-01", level: 2, reps: 10 }],
    sessions: [
      {
        id: "x1",
        date: "2026-06-02",
        level: 2,
        targetReps: 4,
        roundsPlanned: 5,
        roundsCompleted: 5,
        repsPerRound: [4, 4, 4, 4, 4],
        rpe: 6,
        painFlags: [],
      },
    ],
    lastHabitWeekEvaluated: "2026-06-01",
    settings: {
      habitDaysPerWeek: 7,
      goalReps: 50,
      sound: true,
      haptics: true,
    },
  });

  it("accepts a valid backup and preserves history", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    assert.equal(out.level, 2);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.maxTests.length, 1);
    // dropped legacy field is gone from the migrated shape
    assert.equal("lastHabitWeekEvaluated" in out, false);
    assert.equal("roundRepsHabit" in out, false);
  });

  it("migrates a strength-era backup, keeping sessions as plain history", () => {
    const legacy = {
      level: 2,
      maxTests: [{ date: "2026-06-01", level: 2, reps: 10 }],
      sessions: [
        {
          id: "st1",
          date: "2026-06-02",
          track: "strength",
          level: 2,
          targetReps: 5,
          roundsPlanned: 5,
          roundsCompleted: 5,
          repsPerRound: [5, 5, 5, 5, 5],
          rpe: 6,
          painFlags: [],
        },
      ],
      roundRepsHabit: 4,
      roundRepsStrength: 5,
      strengthSuccessStreak: 1,
      deloadRemaining: 0,
      lastHabitWeekEvaluated: "2026-06-01",
      settings: {
        restSeconds: 120,
        habitDaysPerWeek: 7,
        strengthDays: [1, 3, 5],
        goalReps: 50,
        sound: true,
        haptics: true,
        strengthReminder: { enabled: true, hour: 18, minute: 0, days: [1, 3, 5] },
      },
    };
    const out = sanitizeImport(legacy);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal("track" in out.sessions[0]!, false);
    assert.equal("roundRepsStrength" in out, false);
    assert.equal("roundRepsHabit" in out, false);
    assert.equal("strengthDays" in out.settings, false);
    assert.equal("restSeconds" in out.settings, false);
    assert.equal("strengthReminder" in out.settings, false);
  });

  it("rejects non-objects and empty payloads", () => {
    assert.equal(sanitizeImport(null), null);
    assert.equal(sanitizeImport("hello"), null);
    assert.equal(sanitizeImport([]), null);
    assert.equal(sanitizeImport({}), null);
  });

  it("rejects invalid or missing level", () => {
    assert.equal(sanitizeImport({ ...validBackup(), level: 5 }), null);
    assert.equal(sanitizeImport({ ...validBackup(), level: 1.5 }), null);
    assert.equal(sanitizeImport({ ...validBackup(), level: "2" }), null);
  });

  it("rejects backups with no valid max tests", () => {
    assert.equal(sanitizeImport({ ...validBackup(), maxTests: [] }), null);
    assert.equal(
      sanitizeImport({
        ...validBackup(),
        maxTests: [{ date: "bad", level: 2, reps: 10 }],
      }),
      null,
    );
  });

  it("filters malformed sessions but keeps valid ones", () => {
    const backup = validBackup();
    (backup.sessions as unknown[]).push(
      { date: "2026-06-03" },
      null,
      "garbage",
      { ...backup.sessions[0], id: "x2", date: "06/04/2026" },
    );
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.sessions[0]?.id, "x1");
  });

  it("clamps rpe, reps, and pain flags inside sessions", () => {
    const backup = validBackup();
    backup.sessions[0] = {
      ...backup.sessions[0]!,
      rpe: 25 as never,
      repsPerRound: [9999, -5, 5, 5, 5],
      painFlags: ["wrist", "elbow", 42] as never,
      roundsPlanned: 100,
    };
    const out = sanitizeImport(backup);
    assert.ok(out);
    const s = out.sessions[0]!;
    assert.equal(s.rpe, null);
    assert.deepEqual(s.repsPerRound, [999, 0, 5, 5, 5]);
    assert.deepEqual(s.painFlags, ["wrist"]);
    assert.equal(s.roundsPlanned, 20);
  });

  it("falls back to safe settings when settings are malformed", () => {
    const out = sanitizeImport({
      ...validBackup(),
      settings: { habitDaysPerWeek: 2, goalReps: -5, sound: "yes" },
    });
    assert.ok(out);
    assert.equal(out.settings.habitDaysPerWeek, 7);
    assert.equal(out.settings.goalReps, 1);
    assert.equal(out.settings.sound, true);
  });

  it("imported data drives the ramp correctly afterwards", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    // max test reps 10 on 2026-06-01 -> base 4
    assert.equal(sessionRoundReps(out, "2026-06-01"), 4);
    assert.equal(sessionRoundReps(out, "2026-06-04"), 5);
  });
});
