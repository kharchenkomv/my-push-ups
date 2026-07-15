import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  clamp,
  createInitialData,
  currentStreak,
  dailyTargetFor,
  dateKey,
  daysBetween,
  evaluateWeek,
  formatSeconds,
  isHabitDay,
  keyToDate,
  levelCap,
  maxTestDue,
  planForWeekday,
  roundReps,
  sessionTargetReps,
  sessionTypeForWeekday,
  weekStartKey,
  SESSION_ROUNDS,
} from "../lib/training";
import type { AppData, Level, SessionEntry, Settings } from "../lib/types";

function makeData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
    level: 2,
    maxReps: 20,
    health: { cardio: false, joints: false, pain: false, acknowledged: true },
    goalReps: 50,
  });
  return { ...base, ...overrides };
}

function session(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id: `s-${Math.random()}`,
    date: "2026-07-06",
    level: 2,
    targetReps: 10,
    roundsPlanned: SESSION_ROUNDS,
    roundsCompleted: SESSION_ROUNDS,
    repsPerRound: [10, 9, 9, 8, 8],
    rpe: 6,
    painFlags: [],
    ...overrides,
  };
}

describe("date helpers", () => {
  it("dateKey / keyToDate round-trip", () => {
    for (const key of ["2026-07-06", "2024-02-29", "2025-12-31"]) {
      assert.equal(dateKey(keyToDate(key)), key);
    }
  });

  it("addDays crosses boundaries", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  });

  it("daysBetween counts calendar days across DST", () => {
    assert.equal(daysBetween("2026-07-01", "2026-07-08"), 7);
    assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
  });

  it("weekStartKey returns Monday", () => {
    assert.equal(weekStartKey(new Date(2026, 6, 6)), "2026-07-06");
    assert.equal(weekStartKey(new Date(2026, 6, 12)), "2026-07-06");
  });

  it("formatSeconds renders m:ss", () => {
    assert.equal(formatSeconds(45), "0:45");
    assert.equal(formatSeconds(120), "2:00");
  });

  it("clamp bounds values", () => {
    assert.equal(clamp(50, 1, 10), 10);
    assert.equal(clamp(-5, 1, 10), 1);
  });
});

describe("dailyTargetFor (spec §1.3)", () => {
  it("is floor(max × 0.5) within [2, per-level cap]", () => {
    // Level 2 (knee) cap = 10
    assert.equal(dailyTargetFor(20, 2), 10); // floor(10)=10, at cap
    assert.equal(dailyTargetFor(16, 2), 8); // floor(8)
    assert.equal(dailyTargetFor(30, 2), 10); // floor(15) -> capped 10
  });

  it("applies each variation's cap", () => {
    assert.equal(levelCap(0), 15);
    assert.equal(levelCap(1), 12);
    assert.equal(levelCap(2), 10);
    assert.equal(levelCap(3), 8);
    assert.equal(dailyTargetFor(100, 0), 15);
    assert.equal(dailyTargetFor(100, 1), 12);
    assert.equal(dailyTargetFor(100, 3), 8);
  });

  it("never drops below 2", () => {
    assert.equal(dailyTargetFor(2, 3), 2); // floor(1)=1 -> 2
    assert.equal(dailyTargetFor(1, 0), 2);
  });
});

describe("session types (spec §1.4/§1.5)", () => {
  it("maps the fixed weekly pattern by weekday", () => {
    assert.equal(sessionTypeForWeekday(1), "standard"); // Mon
    assert.equal(sessionTypeForWeekday(2), "lighter"); // Tue
    assert.equal(sessionTypeForWeekday(3), "standard"); // Wed
    assert.equal(sessionTypeForWeekday(4), "easy"); // Thu
    assert.equal(sessionTypeForWeekday(5), "standard"); // Fri
    assert.equal(sessionTypeForWeekday(6), "lighter"); // Sat
    assert.equal(sessionTypeForWeekday(0), "standard"); // Sun
  });

  it("scales the target by intensity, floored at 2", () => {
    assert.equal(sessionTargetReps(10, "standard"), 10);
    assert.equal(sessionTargetReps(10, "lighter"), 9); // round(8.5)
    assert.equal(sessionTargetReps(10, "easy"), 7); // round(6.5)
    assert.equal(sessionTargetReps(2, "easy"), 2); // floored
  });
});

describe("roundReps (spec §1.2 descending)", () => {
  it("produces a non-increasing 5-round sequence", () => {
    const r = roundReps(10);
    assert.equal(r.length, 5);
    assert.deepEqual(r, [10, 9, 9, 8, 8]);
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i]! <= r[i - 1]!, "non-increasing");
    }
  });

  it("keeps round 1 at 100% of the target", () => {
    assert.equal(roundReps(8)[0], 8);
    assert.equal(roundReps(12)[0], 12);
  });

  it("never goes below 1", () => {
    assert.ok(roundReps(2).every((v) => v >= 1));
  });
});

describe("planForWeekday", () => {
  it("Monday is a full Standard session", () => {
    const p = planForWeekday(10, 1);
    assert.equal(p.type, "standard");
    assert.equal(p.target, 10);
    assert.deepEqual(p.rounds, [10, 9, 9, 8, 8]);
    assert.equal(p.total, 44);
  });

  it("Thursday is an Easy session (lower volume)", () => {
    const p = planForWeekday(10, 4);
    assert.equal(p.type, "easy");
    assert.equal(p.target, 7);
    assert.ok(p.total < planForWeekday(10, 1).total);
  });
});

describe("evaluateWeek (spec §2.1)", () => {
  const monday = new Date(2026, 6, 6); // Mon Jul 6
  const prevWeek = [
    "2026-06-29", "2026-06-30", "2026-07-01",
    "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05",
  ];

  function weekData(overrides: Partial<AppData> = {}): AppData {
    return makeData({ lastWeekEvaluated: "2026-06-29", ...overrides });
  }

  it("returns null when the week is already evaluated", () => {
    assert.equal(
      evaluateWeek(makeData({ lastWeekEvaluated: "2026-07-06" }), monday),
      null,
    );
  });

  it("adds +1 after 6+ complete sessions at RPE ≤ 7", () => {
    const data = weekData({
      dailyTarget: 8,
      sessions: prevWeek.slice(0, 6).map((d) => session({ date: d, rpe: 6 })),
    });
    const out = evaluateWeek(data, monday);
    assert.equal(out?.dailyTarget, 9);
    assert.equal(out?.lastWeekEvaluated, "2026-07-06");
  });

  it("does not increase past the level cap", () => {
    // level 2 cap = 10
    const data = weekData({
      dailyTarget: 10,
      sessions: prevWeek.slice(0, 7).map((d) => session({ date: d, rpe: 6 })),
    });
    assert.equal(evaluateWeek(data, monday)?.dailyTarget, 10);
  });

  it("does not increase with only 5 sessions", () => {
    const data = weekData({
      dailyTarget: 8,
      sessions: prevWeek.slice(0, 5).map((d) => session({ date: d, rpe: 6 })),
    });
    assert.equal(evaluateWeek(data, monday)?.dailyTarget, 8); // hold
  });

  it("drops 1 when average RPE ≥ 8", () => {
    const data = weekData({
      dailyTarget: 8,
      sessions: prevWeek.slice(0, 6).map((d) => session({ date: d, rpe: 9 })),
    });
    assert.equal(evaluateWeek(data, monday)?.dailyTarget, 7);
  });

  it("drops 1 when rounds were left unfinished", () => {
    const data = weekData({
      dailyTarget: 8,
      sessions: prevWeek
        .slice(0, 6)
        .map((d) => session({ date: d, rpe: 6, roundsCompleted: 3 })),
    });
    assert.equal(evaluateWeek(data, monday)?.dailyTarget, 7);
  });

  it("never drops below 2", () => {
    const data = weekData({
      dailyTarget: 2,
      sessions: [session({ date: "2026-06-29", rpe: 10 })],
    });
    assert.equal(evaluateWeek(data, monday)?.dailyTarget, 2);
  });

  it("holds and moves the marker when no sessions were done", () => {
    const data = weekData({ dailyTarget: 8, sessions: [] });
    const out = evaluateWeek(data, monday);
    assert.equal(out?.dailyTarget, 8);
    assert.equal(out?.lastWeekEvaluated, "2026-07-06");
  });

  it("ignores sessions outside the previous week", () => {
    const data = weekData({
      dailyTarget: 8,
      sessions: [
        session({ date: "2026-06-22", rpe: 10 }), // week before
        session({ date: "2026-07-06", rpe: 10 }), // current week
      ],
    });
    assert.equal(evaluateWeek(data, monday)?.dailyTarget, 8); // no prev-week data
  });
});

describe("isHabitDay", () => {
  function settings(n: number): Settings {
    return { ...makeData().settings, habitDaysPerWeek: n };
  }
  it("7 = every day, 6 = skip Sunday, 5 = weekdays", () => {
    assert.equal(isHabitDay(settings(7), 0), true);
    assert.equal(isHabitDay(settings(6), 0), false);
    assert.equal(isHabitDay(settings(6), 3), true);
    assert.equal(isHabitDay(settings(5), 6), false);
    assert.equal(isHabitDay(settings(5), 2), true);
  });
});

describe("streak and re-test scheduling", () => {
  it("currentStreak counts consecutive days ending today", () => {
    const s = [
      session({ id: "a", date: "2026-07-04" }),
      session({ id: "b", date: "2026-07-05" }),
      session({ id: "c", date: "2026-07-06" }),
    ];
    assert.equal(currentStreak(s, "2026-07-06"), 3);
  });

  it("currentStreak resets after a gap", () => {
    const s = [
      session({ id: "a", date: "2026-07-01" }),
      session({ id: "b", date: "2026-07-06" }),
    ];
    assert.equal(currentStreak(s, "2026-07-06"), 1);
  });

  it("maxTestDue after 21 days, not before", () => {
    const today = dateKey();
    assert.equal(
      maxTestDue(makeData({ maxTests: [{ date: addDays(today, -20), level: 2 as Level, reps: 10 }] })),
      false,
    );
    assert.equal(
      maxTestDue(makeData({ maxTests: [{ date: addDays(today, -21), level: 2 as Level, reps: 10 }] })),
      true,
    );
    assert.equal(maxTestDue(makeData({ maxTests: [] })), true);
  });
});
