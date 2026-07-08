import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applyStrengthResult,
  canLevelUp,
  createInitialData,
  evaluateHabitWeek,
  keyToDate,
  sanitizeImport,
  strengthCap,
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
function strengthSession(
  data: AppData,
  date: string,
  opts: { rpe: number; missRounds?: number } = { rpe: 6 },
): SessionEntry {
  const target = data.roundRepsStrength;
  const reps = [target, target, target, target, target];
  for (let i = 0; i < (opts.missRounds ?? 0); i++) {
    reps[i] = Math.max(0, target - 1);
  }
  return {
    id: `sim-${idCounter++}`,
    date,
    track: "strength",
    level: data.level,
    targetReps: target,
    roundsPlanned: 5,
    roundsCompleted: 5,
    repsPerRound: reps,
    rpe: opts.rpe,
    painFlags: [],
  };
}

function habitSession(data: AppData, date: string, rpe: number): SessionEntry {
  const target = data.roundRepsHabit;
  return {
    id: `sim-${idCounter++}`,
    date,
    track: "habit",
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
  let next: AppData = { ...data, sessions: [...data.sessions, s] };
  if (s.track === "strength") {
    next = { ...next, ...applyStrengthResult(next, s) };
  }
  return next;
}

// Monday to anchor all simulations
const WEEK1_MONDAY = "2026-06-01";

describe("4-week simulation: steady progression", () => {
  it("adds exactly 1 rep per 2 strong sessions and never skips", () => {
    let data = freshData(); // roundRepsStrength starts at 3
    const startReps = data.roundRepsStrength;
    assert.equal(startReps, 3);

    // 4 weeks, Mon/Wed/Fri strength = 12 strong sessions
    let sessionCount = 0;
    for (let week = 0; week < 4; week++) {
      for (const offset of [0, 2, 4]) {
        const date = addDays(WEEK1_MONDAY, week * 7 + offset);
        data = logSession(data, strengthSession(data, date, { rpe: 6 }));
        sessionCount++;
        const expected: number = startReps + Math.floor(sessionCount / 2);
        assert.equal(
          data.roundRepsStrength,
          expected,
          `after session ${sessionCount}`,
        );
      }
    }
    assert.equal(data.roundRepsStrength, startReps + 6);
    assert.equal(data.deloadRemaining, 0);
    assert.equal(data.strengthSuccessStreak, 0);
    // 9 reps is above the level-2 gate of 8, last two sessions strong
    assert.equal(canLevelUp(data), true);
  });

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
});

describe("4-week simulation: failure and deload", () => {
  it("hard weeks drop reps but never below 3", () => {
    let data = freshData(); // starts at 3
    for (let week = 0; week < 4; week++) {
      for (const offset of [0, 2, 4]) {
        const date = addDays(WEEK1_MONDAY, week * 7 + offset);
        data = logSession(data, strengthSession(data, date, { rpe: 9 }));
        assert.equal(data.roundRepsStrength, 3);
        assert.equal(data.strengthSuccessStreak, 0);
      }
    }
    assert.equal(data.deloadRemaining, 0);
    assert.equal(canLevelUp(data), false);
  });

  it("climbing to the cap triggers exactly one deload over many sessions", () => {
    // cap for level 2 with max 10 is 15
    let data = freshData({ roundRepsStrength: 13 });
    const cap = strengthCap(data.level, 10);
    assert.equal(cap, 15);

    let deloadTriggers = 0;
    let prevDeload = data.deloadRemaining;
    for (let i = 0; i < 24; i++) {
      const date = addDays(WEEK1_MONDAY, i * 2);
      data = logSession(data, strengthSession(data, date, { rpe: 6 }));
      if (data.deloadRemaining === 3 && prevDeload === 0) deloadTriggers++;
      prevDeload = data.deloadRemaining;
      assert.ok(data.roundRepsStrength <= cap, "reps never exceed cap");
    }
    assert.equal(deloadTriggers, 1);
    assert.equal(data.roundRepsStrength, cap);
    assert.equal(data.deloadRemaining, 0);
  });

  it("mixed month: failure resets streak so progress needs 2 fresh strong sessions", () => {
    let data = freshData({ roundRepsStrength: 6 });
    // strong, fail, strong, strong -> net: -1 then +1 = back to 6
    data = logSession(data, strengthSession(data, "2026-06-01", { rpe: 6 }));
    assert.equal(data.strengthSuccessStreak, 1);
    data = logSession(data, strengthSession(data, "2026-06-03", { rpe: 9 }));
    assert.equal(data.roundRepsStrength, 5);
    assert.equal(data.strengthSuccessStreak, 0);
    data = logSession(data, strengthSession(data, "2026-06-05", { rpe: 6 }));
    assert.equal(data.roundRepsStrength, 5);
    data = logSession(data, strengthSession(data, "2026-06-08", { rpe: 6 }));
    assert.equal(data.roundRepsStrength, 6);
  });

  it("missing 2 rounds counts as failure even with low RPE", () => {
    let data = freshData({ roundRepsStrength: 6, strengthSuccessStreak: 1 });
    data = logSession(
      data,
      strengthSession(data, "2026-06-01", { rpe: 5, missRounds: 2 }),
    );
    assert.equal(data.roundRepsStrength, 5);
    assert.equal(data.strengthSuccessStreak, 0);
  });
});

describe("week rollover", () => {
  it("skipped weeks each evaluate once, decaying habit reps gradually", () => {
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
    },
  });

  it("accepts a valid backup and preserves engine state", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    assert.equal(out.level, 2);
    assert.equal(out.roundRepsStrength, 5);
    assert.equal(out.strengthSuccessStreak, 1);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.maxTests.length, 1);
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
      roundRepsStrength: -10,
      strengthSuccessStreak: 50,
      deloadRemaining: 99,
    });
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 15);
    assert.equal(out.roundRepsStrength, 3);
    assert.equal(out.strengthSuccessStreak, 2);
    assert.equal(out.deloadRemaining, 3);
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
        restSeconds: 9999,
        habitDaysPerWeek: 2,
        strengthDays: [1, 2, 3], // consecutive -> invalid
        goalReps: -5,
        sound: "yes",
      },
    });
    assert.ok(out);
    assert.equal(out.settings.restSeconds, 150);
    assert.equal(out.settings.habitDaysPerWeek, 7);
    assert.deepEqual(out.settings.strengthDays, [1, 3, 5]);
    assert.equal(out.settings.goalReps, 1);
    assert.equal(out.settings.sound, true);
  });

  it("derives missing engine numbers from the latest max test", () => {
    const backup = validBackup() as Record<string, unknown>;
    delete backup.roundRepsHabit;
    delete backup.roundRepsStrength;
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 4); // 40% of 10
    assert.equal(out.roundRepsStrength, 3);
  });

  it("imported data keeps working in the engine afterwards", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    let data = out;
    data = logSession(data, strengthSession(data, "2026-06-05", { rpe: 6 }));
    // streak was 1 from the backup, so a strong session progresses
    assert.equal(data.roundRepsStrength, 6);
    assert.equal(data.strengthSuccessStreak, 0);
  });
});
