import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applyStrengthResult,
  canLevelUp,
  clamp,
  computeHabitReps,
  computeStrengthReps,
  createInitialData,
  currentStreak,
  dateKey,
  daysBetween,
  evaluateHabitWeek,
  failedRounds,
  formatSeconds,
  isNonConsecutiveDays,
  isStrongSession,
  keyToDate,
  maxTestDue,
  sanitizeImport,
  strengthCap,
  weekStartKey,
} from "../lib/training";
import type { AppData, SessionEntry } from "../lib/types";

function makeSession(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id: "s1",
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

function makeData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    level: 2,
    maxReps: 10,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

describe("date helpers", () => {
  it("dateKey formats with zero padding", () => {
    assert.equal(dateKey(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(dateKey(new Date(2026, 11, 31)), "2026-12-31");
  });

  it("keyToDate round-trips with dateKey", () => {
    for (const key of ["2026-07-06", "2024-02-29", "2025-12-31"]) {
      assert.equal(dateKey(keyToDate(key)), key);
    }
  });

  it("addDays crosses month and year boundaries", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  });

  it("addDays is reversible over long ranges", () => {
    const start = "2026-01-15";
    assert.equal(addDays(addDays(start, 100), -100), start);
  });

  it("daysBetween counts calendar days", () => {
    assert.equal(daysBetween("2026-07-01", "2026-07-08"), 7);
    assert.equal(daysBetween("2026-07-08", "2026-07-01"), -7);
    assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
    // across a US DST transition (March 8, 2026)
    assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
  });

  it("weekStartKey returns the Monday of the week", () => {
    // Monday July 6, 2026
    assert.equal(weekStartKey(new Date(2026, 6, 6)), "2026-07-06");
    // Sunday July 12 still belongs to the week starting July 6
    assert.equal(weekStartKey(new Date(2026, 6, 12)), "2026-07-06");
    // Tuesday July 7
    assert.equal(weekStartKey(new Date(2026, 6, 7)), "2026-07-06");
    // next Monday starts a new week
    assert.equal(weekStartKey(new Date(2026, 6, 13)), "2026-07-13");
  });

  it("formatSeconds renders m:ss", () => {
    assert.equal(formatSeconds(0), "0:00");
    assert.equal(formatSeconds(45), "0:45");
    assert.equal(formatSeconds(120), "2:00");
    assert.equal(formatSeconds(125), "2:05");
  });

  it("clamp bounds values", () => {
    assert.equal(clamp(5, 1, 10), 5);
    assert.equal(clamp(-5, 1, 10), 1);
    assert.equal(clamp(50, 1, 10), 10);
  });
});

describe("rep computation", () => {
  it("computeHabitReps takes 40% of max, clamped 3..15", () => {
    assert.equal(computeHabitReps(10), 4);
    assert.equal(computeHabitReps(2), 3);
    assert.equal(computeHabitReps(100), 15);
  });

  it("strengthCap depends on level and max", () => {
    assert.equal(strengthCap(0, 10), 10);
    assert.equal(strengthCap(1, 10), 12);
    assert.equal(strengthCap(2, 10), 15);
    assert.equal(strengthCap(3, 10), 15);
    assert.equal(strengthCap(3, 20), 40);
  });

  it("computeStrengthReps clamps between 3 and cap", () => {
    assert.equal(computeStrengthReps(10, 2), 3);
    assert.equal(computeStrengthReps(30, 2), 4);
    assert.equal(computeStrengthReps(200, 2), 15);
  });

  it("isNonConsecutiveDays rejects adjacent days including Sun-Sat wrap", () => {
    assert.equal(isNonConsecutiveDays([1, 3, 5]), true);
    assert.equal(isNonConsecutiveDays([1, 2, 4]), false);
    assert.equal(isNonConsecutiveDays([0, 3, 6]), false); // Sun & Sat wrap around
    assert.equal(isNonConsecutiveDays([0, 2, 4]), true);
  });
});

describe("session classification", () => {
  it("isStrongSession requires rpe<=7 and all targets met", () => {
    assert.equal(isStrongSession(makeSession()), true);
    assert.equal(isStrongSession(makeSession({ rpe: 8 })), false);
    assert.equal(isStrongSession(makeSession({ rpe: null })), false);
    assert.equal(
      isStrongSession(makeSession({ repsPerRound: [5, 5, 5, 5, 4] })),
      false,
    );
    assert.equal(isStrongSession(makeSession({ roundsCompleted: 4 })), false);
  });

  it("failedRounds counts rounds below target", () => {
    assert.equal(failedRounds(makeSession()), 0);
    assert.equal(
      failedRounds(makeSession({ repsPerRound: [5, 4, 3, 5, 5] })),
      2,
    );
    assert.equal(failedRounds(makeSession({ repsPerRound: [5, 5, 5] })), 2);
  });
});

describe("applyStrengthResult", () => {
  it("one strong session builds streak without changing reps", () => {
    const data = makeData({ roundRepsStrength: 5, strengthSuccessStreak: 0 });
    const out = applyStrengthResult(data, makeSession({ targetReps: 5 }));
    assert.equal(out.roundRepsStrength, 5);
    assert.equal(out.strengthSuccessStreak, 1);
    assert.equal(out.deloadRemaining, 0);
  });

  it("two strong sessions add one rep and reset streak", () => {
    const data = makeData({ roundRepsStrength: 5, strengthSuccessStreak: 1 });
    const out = applyStrengthResult(data, makeSession({ targetReps: 5 }));
    assert.equal(out.roundRepsStrength, 6);
    assert.equal(out.strengthSuccessStreak, 0);
  });

  it("RPE >= 9 drops a rep and resets streak", () => {
    const data = makeData({ roundRepsStrength: 6, strengthSuccessStreak: 1 });
    const out = applyStrengthResult(data, makeSession({ rpe: 9 }));
    assert.equal(out.roundRepsStrength, 5);
    assert.equal(out.strengthSuccessStreak, 0);
  });

  it("2+ failed rounds drop a rep even with low RPE", () => {
    const data = makeData({ roundRepsStrength: 6, strengthSuccessStreak: 1 });
    const out = applyStrengthResult(
      data,
      makeSession({ rpe: 5, repsPerRound: [5, 4, 4, 5, 5], targetReps: 5 }),
    );
    assert.equal(out.roundRepsStrength, 5);
    assert.equal(out.strengthSuccessStreak, 0);
  });

  it("exactly 1 failed round with ok RPE resets streak but keeps reps", () => {
    const data = makeData({ roundRepsStrength: 6, strengthSuccessStreak: 1 });
    const out = applyStrengthResult(
      data,
      makeSession({ rpe: 6, repsPerRound: [6, 5, 6, 6, 6], targetReps: 6 }),
    );
    assert.equal(out.roundRepsStrength, 6);
    assert.equal(out.strengthSuccessStreak, 0);
  });

  it("reps never drop below 3", () => {
    const data = makeData({ roundRepsStrength: 3 });
    const out = applyStrengthResult(data, makeSession({ rpe: 10 }));
    assert.equal(out.roundRepsStrength, 3);
  });

  it("reaching the cap triggers a 3-session deload exactly once", () => {
    // level 2 with max 10 -> cap 15
    let data = makeData({
      roundRepsStrength: 14,
      strengthSuccessStreak: 1,
      deloadRemaining: 0,
    });
    const out = applyStrengthResult(
      data,
      makeSession({ targetReps: 14, repsPerRound: [14, 14, 14, 14, 14] }),
    );
    assert.equal(out.roundRepsStrength, 15);
    assert.equal(out.deloadRemaining, 3);

    // subsequent strong sessions at cap must NOT re-trigger deload
    data = { ...data, ...out } as AppData;
    for (const expected of [2, 1, 0]) {
      const step = applyStrengthResult(
        data,
        makeSession({ targetReps: 15, repsPerRound: [15, 15, 15, 15, 15] }),
      );
      assert.equal(step.roundRepsStrength, 15);
      assert.equal(step.deloadRemaining, expected);
      data = { ...data, ...step } as AppData;
    }

    // after deload ends, strong sessions at cap never restart a deload
    for (let i = 0; i < 4; i++) {
      const step = applyStrengthResult(
        data,
        makeSession({ targetReps: 15, repsPerRound: [15, 15, 15, 15, 15] }),
      );
      assert.equal(step.deloadRemaining, 0);
      assert.equal(step.roundRepsStrength, 15);
      data = { ...data, ...step } as AppData;
    }
  });

  it("dropping below the cap and climbing back re-triggers deload once", () => {
    let data = makeData({
      roundRepsStrength: 15,
      strengthSuccessStreak: 0,
      deloadRemaining: 0,
    });
    const drop = applyStrengthResult(data, makeSession({ rpe: 9 }));
    assert.equal(drop.roundRepsStrength, 14);
    data = { ...data, ...drop } as AppData;

    // two strong sessions -> back to cap -> new deload
    let step = applyStrengthResult(
      data,
      makeSession({ targetReps: 14, repsPerRound: [14, 14, 14, 14, 14] }),
    );
    data = { ...data, ...step } as AppData;
    step = applyStrengthResult(
      data,
      makeSession({ targetReps: 14, repsPerRound: [14, 14, 14, 14, 14] }),
    );
    assert.equal(step.roundRepsStrength, 15);
    assert.equal(step.deloadRemaining, 3);
  });

  it("uses default max of 5 when no max test exists for level", () => {
    const data = makeData({ maxTests: [], roundRepsStrength: 3 });
    const out = applyStrengthResult(data, makeSession());
    assert.equal(typeof out.roundRepsStrength, "number");
  });
});

describe("evaluateHabitWeek", () => {
  // Monday July 6, 2026; previous week is June 29 - July 5
  const monday = new Date(2026, 6, 6);
  const prevWeek = ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];

  function habit(date: string, rpe: number | null): SessionEntry {
    return makeSession({ id: `h-${date}`, date, track: "habit", rpe });
  }

  it("returns null when the week was already evaluated", () => {
    const data = makeData({ lastHabitWeekEvaluated: "2026-07-06" });
    assert.equal(evaluateHabitWeek(data, monday), null);
  });

  it("adds a rep after 5+ easy sessions", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: prevWeek.slice(0, 5).map((d) => habit(d, 5)),
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 6);
    assert.equal(out.lastHabitWeekEvaluated, "2026-07-06");
  });

  it("drops a rep when average RPE is high", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: prevWeek.slice(0, 4).map((d) => habit(d, 9)),
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 4);
  });

  it("drops a rep when fewer than 3 sessions were done", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: prevWeek.slice(0, 2).map((d) => habit(d, 5)),
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 4);
  });

  it("keeps reps steady with 3-4 moderate sessions", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: prevWeek.slice(0, 4).map((d) => habit(d, 6)),
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 5);
  });

  it("keeps reps unchanged when there were no habit sessions", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: [],
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    assert.equal(out.roundRepsHabit, 5);
    assert.equal(out.lastHabitWeekEvaluated, "2026-07-06");
  });

  it("never exceeds 15 or drops below 3", () => {
    const up = evaluateHabitWeek(
      makeData({
        roundRepsHabit: 15,
        lastHabitWeekEvaluated: "2026-06-29",
        sessions: prevWeek.slice(0, 5).map((d) => habit(d, 4)),
      }),
      monday,
    );
    assert.equal(up?.roundRepsHabit, 15);

    const down = evaluateHabitWeek(
      makeData({
        roundRepsHabit: 3,
        lastHabitWeekEvaluated: "2026-06-29",
        sessions: [habit("2026-06-29", 10)],
      }),
      monday,
    );
    assert.equal(down?.roundRepsHabit, 3);
  });

  it("ignores strength sessions and sessions outside the previous week", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: [
        makeSession({ id: "st", date: "2026-06-30", track: "strength", rpe: 10 }),
        habit("2026-06-28", 10), // week before previous
        habit("2026-07-06", 10), // current week
      ],
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    // no habit sessions in previous week -> unchanged
    assert.equal(out.roundRepsHabit, 5);
  });

  it("treats unrated sessions as neutral (avg defaults to 5)", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: prevWeek.slice(0, 5).map((d) => habit(d, null)),
    });
    const out = evaluateHabitWeek(data, monday);
    assert.equal(out?.roundRepsHabit, 6);
  });
});

describe("canLevelUp", () => {
  function strong(date: string, level: 0 | 1 | 2 | 3): SessionEntry {
    return makeSession({ id: `s-${date}`, date, level, track: "strength" });
  }

  it("never allows level up at the top level", () => {
    const data = makeData({
      level: 3,
      roundRepsStrength: 40,
      sessions: [strong("2026-07-01", 3), strong("2026-07-03", 3)],
    });
    assert.equal(canLevelUp(data), false);
  });

  it("requires reps at or above the threshold", () => {
    const data = makeData({
      level: 2,
      roundRepsStrength: 7,
      sessions: [strong("2026-07-01", 2), strong("2026-07-03", 2)],
    });
    assert.equal(canLevelUp(data), false);
  });

  it("requires the last two strength sessions at this level to be strong", () => {
    const base = makeData({ level: 2, roundRepsStrength: 8 });
    assert.equal(
      canLevelUp({
        ...base,
        sessions: [strong("2026-07-01", 2), strong("2026-07-03", 2)],
      }),
      true,
    );
    assert.equal(
      canLevelUp({
        ...base,
        sessions: [
          strong("2026-07-01", 2),
          makeSession({ id: "weak", date: "2026-07-03", level: 2, rpe: 9 }),
        ],
      }),
      false,
    );
    assert.equal(
      canLevelUp({ ...base, sessions: [strong("2026-07-03", 2)] }),
      false,
    );
  });

  it("ignores sessions from other levels", () => {
    const data = makeData({
      level: 2,
      roundRepsStrength: 8,
      sessions: [strong("2026-07-01", 1), strong("2026-07-03", 1)],
    });
    assert.equal(canLevelUp(data), false);
  });
});

describe("streak and max test scheduling", () => {
  it("currentStreak counts consecutive days ending today", () => {
    const today = "2026-07-06";
    const sessions = [
      makeSession({ id: "a", date: "2026-07-04" }),
      makeSession({ id: "b", date: "2026-07-05" }),
      makeSession({ id: "c", date: "2026-07-06" }),
    ];
    assert.equal(currentStreak(sessions, today), 3);
  });

  it("currentStreak survives no session yet today", () => {
    const sessions = [
      makeSession({ id: "a", date: "2026-07-04" }),
      makeSession({ id: "b", date: "2026-07-05" }),
    ];
    assert.equal(currentStreak(sessions, "2026-07-06"), 2);
  });

  it("currentStreak resets after a gap", () => {
    const sessions = [
      makeSession({ id: "a", date: "2026-07-01" }),
      makeSession({ id: "b", date: "2026-07-05" }),
      makeSession({ id: "c", date: "2026-07-06" }),
    ];
    assert.equal(currentStreak(sessions, "2026-07-06"), 2);
  });

  it("maxTestDue after 21 days, not before", () => {
    const today = dateKey();
    const fresh = makeData({
      maxTests: [{ date: addDays(today, -20), level: 2, reps: 10 }],
    });
    assert.equal(maxTestDue(fresh), false);

    const stale = makeData({
      maxTests: [{ date: addDays(today, -21), level: 2, reps: 10 }],
    });
    assert.equal(maxTestDue(stale), true);

    const never = makeData({ maxTests: [] });
    assert.equal(maxTestDue(never), true);
  });
});
