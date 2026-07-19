import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  createInitialData,
  dailyTargetFor,
  evaluateWeek,
  keyToDate,
  planForWeekday,
  sanitizeImport,
  weekStartKey,
  SESSION_ROUNDS,
} from "../lib/training";
import type { AppData, SessionEntry } from "../lib/types";

function freshData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    level: 2,
    maxReps: 20,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

let counter = 0;
function logSession(
  data: AppData,
  date: string,
  opts: { rpe: number; roundsCompleted?: number } = { rpe: 6 },
): AppData {
  const s: SessionEntry = {
    id: `sim-${counter++}`,
    date,
    level: data.level,
    targetReps: data.dailyTarget,
    roundsPlanned: SESSION_ROUNDS,
    roundsCompleted: opts.roundsCompleted ?? SESSION_ROUNDS,
    repsPerRound: [data.dailyTarget, data.dailyTarget],
    rpe: opts.rpe,
    painFlags: [],
  };
  return { ...data, sessions: [...data.sessions, s] };
}

const WEEK1_MONDAY = "2026-06-01"; // a Monday

describe("weekly progression simulation", () => {
  it("adds +1/week with 6 clean sessions, capped at the level cap", () => {
    let data = freshData({
      dailyTarget: 6,
      lastWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)),
    });
    const perWeek: number[] = [];
    for (let week = 0; week < 5; week++) {
      for (let d = 0; d < 6; d++) {
        data = logSession(data, addDays(WEEK1_MONDAY, week * 7 + d), { rpe: 6 });
      }
      const nextMonday = keyToDate(addDays(WEEK1_MONDAY, (week + 1) * 7));
      const out = evaluateWeek(data, nextMonday);
      assert.ok(out, `week ${week + 1} should evaluate`);
      data = { ...data, ...out };
      // a second call the same week is a no-op
      assert.equal(evaluateWeek(data, nextMonday), null);
      perWeek.push(data.dailyTarget);
    }
    // 6 -> 7,8,9,10, then capped at 10 (level 2)
    assert.deepEqual(perWeek, [7, 8, 9, 10, 10]);
  });

  it("hard weeks push the target down but never below 2", () => {
    let data = freshData({
      dailyTarget: 5,
      lastWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)),
    });
    for (let week = 0; week < 5; week++) {
      for (let d = 0; d < 6; d++) {
        data = logSession(data, addDays(WEEK1_MONDAY, week * 7 + d), { rpe: 9 });
      }
      const out = evaluateWeek(data, keyToDate(addDays(WEEK1_MONDAY, (week + 1) * 7)));
      data = { ...data, ...out };
      assert.ok(data.dailyTarget >= 2);
    }
    assert.equal(data.dailyTarget, 2);
  });

  it("a sparse week holds, and re-opening the same week never re-applies", () => {
    let data = freshData({
      dailyTarget: 8,
      lastWeekEvaluated: weekStartKey(keyToDate(WEEK1_MONDAY)),
    });
    data = logSession(data, addDays(WEEK1_MONDAY, 1), { rpe: 5 });
    const monday2 = keyToDate(addDays(WEEK1_MONDAY, 7));
    data = { ...data, ...evaluateWeek(data, monday2) };
    assert.equal(data.dailyTarget, 8); // 1 session, RPE fine, all rounds done -> hold
    for (let d = 0; d < 7; d++) {
      assert.equal(evaluateWeek(data, keyToDate(addDays(WEEK1_MONDAY, 7 + d))), null);
    }
  });

  it("the descending plan totals stay reasonable as the target grows", () => {
    // sanity: Standard-day total for a mid target
    const p = planForWeekday(10, 1);
    assert.equal(p.total, 44);
    assert.ok(p.total <= SESSION_ROUNDS * 10);
  });
});

describe("import of malformed backups", () => {
  const validBackup = () => ({
    level: 2,
    maxTests: [{ date: "2026-06-01", level: 2, reps: 20 }],
    sessions: [
      {
        id: "x1",
        date: "2026-06-02",
        level: 2,
        targetReps: 10,
        roundsPlanned: 5,
        roundsCompleted: 5,
        repsPerRound: [10, 9, 9, 8, 8],
        rpe: 6,
        painFlags: [],
      },
    ],
    dailyTarget: 10,
    lastWeekEvaluated: "2026-06-01",
    settings: {
      habitDaysPerWeek: 7,
      restSeconds: 60,
      goalReps: 50,
      sound: true,
      haptics: true,
    },
  });

  it("accepts a valid backup and preserves state", () => {
    const out = sanitizeImport(validBackup());
    assert.ok(out);
    assert.equal(out.level, 2);
    assert.equal(out.dailyTarget, 10);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.settings.restSeconds, 60);
  });

  it("keeps a valid elbow pain flag and drops unknown ones (spec §3.1)", () => {
    const backup = validBackup();
    const out = sanitizeImport({
      ...backup,
      sessions: [{ ...backup.sessions[0], painFlags: ["elbow", "made-up"] }],
    });
    assert.ok(out);
    assert.deepEqual(out.sessions[0]?.painFlags, ["elbow"]);
  });

  it("migrates a strength-era / ramp-era backup, dropping unknown fields", () => {
    const legacy = {
      level: 2,
      maxTests: [{ date: "2026-06-01", level: 2, reps: 20 }],
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
      lastHabitWeekEvaluated: "2026-06-01",
      settings: {
        habitDaysPerWeek: 7,
        strengthDays: [1, 3, 5],
        goalReps: 50,
        sound: true,
        haptics: true,
      },
    };
    const out = sanitizeImport(legacy);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal("track" in out.sessions[0]!, false);
    assert.equal("roundRepsHabit" in out, false);
    assert.equal("roundRepsStrength" in out, false);
    assert.equal("strengthDays" in out.settings, false);
    // dailyTarget derived from the latest max test: floor(20*0.5)=10, cap 10
    assert.equal(out.dailyTarget, 10);
    // rest gets the default when absent
    assert.equal(out.settings.restSeconds, 60);
  });

  it("rejects non-objects, empty payloads, and bad levels", () => {
    assert.equal(sanitizeImport(null), null);
    assert.equal(sanitizeImport({}), null);
    assert.equal(sanitizeImport({ ...validBackup(), level: 5 }), null);
    assert.equal(sanitizeImport({ ...validBackup(), maxTests: [] }), null);
  });

  it("clamps rest above 2 minutes and out-of-range dailyTarget", () => {
    const over = sanitizeImport({
      ...validBackup(),
      dailyTarget: 999,
      settings: { ...validBackup().settings, restSeconds: 9999 },
    });
    assert.ok(over);
    assert.equal(over.settings.restSeconds, 120); // capped at 2 min
    assert.equal(over.dailyTarget, 10); // capped at level-2 cap
  });

  it("filters malformed sessions but keeps valid ones", () => {
    const backup = validBackup();
    (backup.sessions as unknown[]).push({ date: "2026-06-03" }, null, "garbage");
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.sessions.length, 1);
    assert.equal(out.sessions[0]?.id, "x1");
  });

  it("derives dailyTarget from the latest max test when missing", () => {
    const backup = validBackup() as Record<string, unknown>;
    delete backup.dailyTarget;
    const out = sanitizeImport(backup);
    assert.ok(out);
    assert.equal(out.dailyTarget, dailyTargetFor(20, 2));
  });
});
