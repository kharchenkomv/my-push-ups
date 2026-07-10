import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  createInitialData,
  evaluateHabitWeek,
  keyToDate,
  sanitizeImport,
  weekStartKey,
} from "../lib/training";
import type { AppData, SessionEntry } from "../lib/types";

function freshData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    level: 2,
    maxReps: 10,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

let idCounter = 0;
function habitSession(data: AppData, date: string, rpe: number): SessionEntry {
  const target = data.roundRepsHabit;
  return {
    id: `sim-${idCounter++}`,
    date,
    level: data.level,
    targetReps: target,
    roundsPlanned: 1,
    roundsCompleted: 1,
    repsPerRound: [target],
    rpe,
    painFlags: [],
  };
}

function logSession(data: AppData, s: SessionEntry): AppData {
  return { ...data, sessions: [...data.sessions, s] };
}

// Monday to anchor all simulations
const WEEK1_MONDAY = "2026-06-01";

describe("4-week simulation: steady progression", () => {
  it("habit reps grow weekly with consistent easy sessions, capped at 15", () => {
    let data = freshData({ lastHabitWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)) });
    const repsPerWeek: number[] = [];

    for (let week = 0; week < 4; week++) {
      // log 6 easy habit sessions during the week
      for (let d = 0; d < 6; d++) {
        const date = addDays(WEEK1_MONDAY, week * 7 + d);
        data = logSession(data, habitSession(data, date, 5));
      }
      // next Monday: weekly evaluation runs once
      const nextMonday = keyToDate(addDays(WEEK1_MONDAY, (week + 1) * 7));
      const update = evaluateHabitWeek(data, nextMonday);
      assert.ok(update, `week ${week + 1} evaluation should run`);
      data = { ...data, ...update };
      // second call in the same week is a no-op (no double adjustment)
      assert.equal(evaluateHabitWeek(data, nextMonday), null);
      repsPerWeek.push(data.roundRepsHabit);
    }

    assert.deepEqual(repsPerWeek, [5, 6, 7, 8]);
    assert.ok(data.roundRepsHabit <= 15);
  });

  it("hard weeks drop reps but never below 3", () => {
    let data = freshData({
      roundRepsHabit: 4,
      lastHabitWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)),
    });
    for (let week = 0; week < 4; week++) {
      // 5 hard sessions per week (avg RPE 9)
      for (let d = 0; d < 5; d++) {
        const date = addDays(WEEK1_MONDAY, week * 7 + d);
        data = logSession(data, habitSession(data, date, 9));
      }
      const nextMonday = keyToDate(addDays(WEEK1_MONDAY, (week + 1) * 7));
      const update = evaluateHabitWeek(data, nextMonday);
      assert.ok(update);
      data = { ...data, ...update };
      assert.ok(data.roundRepsHabit >= 3);
    }
    assert.equal(data.roundRepsHabit, 3);
  });
});

describe("week rollover", () => {
  it("skipped weeks each evaluate once, keeping habit reps stable", () => {
    let data = freshData({
      roundRepsHabit: 8,
      lastHabitWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)),
    });
    // user does nothing for 4 weeks; app opened once per week
    for (let week = 1; week <= 4; week++) {
      const monday = keyToDate(addDays(WEEK1_MONDAY, week * 7));
      const update = evaluateHabitWeek(data, monday);
      assert.ok(update);
      data = { ...data, ...update };
    }
    // no sessions at all -> reps unchanged (empty weeks are neutral)
    assert.equal(data.roundRepsHabit, 8);
    assert.equal(
      data.lastHabitWeekEvaluated,
      addDays(WEEK1_MONDAY, 28),
    );
  });

  it("a sparse week (1-2 sessions) drops reps once, not repeatedly", () => {
    let data = freshData({
      roundRepsHabit: 8,
      lastHabitWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)),
    });
    data = logSession(data, habitSession(data, addDays(WEEK1_MONDAY, 1), 5));
    const monday2 = keyToDate(addDays(WEEK1_MONDAY, 7));
    const update = evaluateHabitWeek(data, monday2);
    assert.ok(update);
    data = { ...data, ...update };
    assert.equal(data.roundRepsHabit, 7);
    // opening the app repeatedly the same week never re-applies the drop
    for (let d = 0; d < 7; d++) {
      const sameWeek = keyToDate(addDays(WEEK1_MONDAY, 7 + d));
      assert.equal(evaluateHabitWeek(data, sameWeek), null);
    }
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
        roundsPlanned: 1,
        roundsCompleted: 1,
        repsPerRound: [4],
        rpe: 6,
        painFlags: [],
      },
    ],
    roundRepsHabit: 4,
    lastHabitWeekEvaluated: "2026-06-01",
    settings: {
      habitDaysPerWeek: 7,
      goalReps: 50,
      sound: true,
      haptics: true,
    },
  });

  it("accepts a valid backup and preserves state", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    assert.equal(out.level, 2);
    assert.equal(out.roundRepsHabit, 4);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.maxTests.length, 1);
  });

  it("accepts a legacy strength-era backup, keeping sessions as history", () => {
    // Shape written by app versions that still had the strength track.
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
        {
          id: "h1",
          date: "2026-06-03",
          track: "habit",
          level: 2,
          targetReps: 4,
          roundsPlanned: 1,
          roundsCompleted: 1,
          repsPerRound: [4],
          rpe: 5,
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
    // both sessions survive as plain history
    assert.equal(out.sessions.length, 2);
    assert.equal(out.roundRepsHabit, 4);
    // strength fields are dropped from the migrated shape
    assert.equal("roundRepsStrength" in out, false);
    assert.equal("track" in out.sessions[0]!, false);
    assert.equal("strengthDays" in out.settings, false);
    assert.equal("restSeconds" in out.settings, false);
    assert.equal("strengthReminder" in out.settings, false);
  });

  it("rejects non-objects and totally empty payloads", () => {
    assert.equal(sanitizeImport(null), null);
    assert.equal(sanitizeImport("hello"), null);
    assert.equal(sanitizeImport(42), null);
    assert.equal(sanitizeImport([]), null);
    assert.equal(sanitizeImport({}), null);
  });

  it("rejects invalid or missing level", () => {
    assert.equal(sanitizeImport({ ...validBackup(), level: 5 }), null);
    assert.equal(sanitizeImport({ ...validBackup(), level: -1 }), null);
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
    assert.equal(
      sanitizeImport({ ...validBackup(), maxTests: "nope" }),
      null,
    );
  });

  it("filters malformed sessions but keeps valid ones", () => {
    const backup = validBackup();
    (backup.sessions as unknown[]).push(
      { date: "2026-06-03" }, // missing everything else
      null,
      "garbage",
      { ...backup.sessions[0], id: "x2", date: "06/04/2026" }, // bad date
    );
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.sessions[0]?.id, "x1");
  });

  it("clamps out-of-range engine numbers so state can't drift", () => {
    const out = sanitizeImport({
      ...validBackup(),
      roundRepsHabit: 999,
    });
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 15);

    const low = sanitizeImport({
      ...validBackup(),
      roundRepsHabit: -10,
    });
    assert.ok(low);
    assert.equal(low.roundRepsHabit, 3);
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
      settings: {
        habitDaysPerWeek: 2,
        goalReps: -5,
        sound: "yes",
      },
    });
    assert.ok(out);
    assert.equal(out.settings.habitDaysPerWeek, 7);
    assert.equal(out.settings.goalReps, 1);
    assert.equal(out.settings.sound, true);
  });

  it("derives missing habit reps from the latest max test", () => {
    const backup = validBackup() as Record<string, unknown>;
    delete backup.roundRepsHabit;
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 4); // 40% of 10
  });

  it("imported data keeps working in the engine afterwards", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    let data: AppData = { ...out, lastHabitWeekEvaluated: "2026-06-01" };
    for (let d = 0; d < 5; d++) {
      data = logSession(data, habitSession(data, addDays("2026-06-01", d), 5));
    }
    const update = evaluateHabitWeek(data, keyToDate("2026-06-08"));
    assert.ok(update);
    assert.equal(update.roundRepsHabit, 5); // 4 + 1 after an easy week
  });
});
