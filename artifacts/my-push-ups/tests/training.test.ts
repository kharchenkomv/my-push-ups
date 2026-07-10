import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  canLevelUp,
  clamp,
  computeHabitReps,
  createInitialData,
  currentStreak,
  dateKey,
  daysBetween,
  evaluateHabitWeek,
  formatSeconds,
  isHabitDay,
  keyToDate,
  maxTestDue,
  weekStartKey,
} from "../lib/training";
import type { AppData, SessionEntry, Settings } from "../lib/types";

function makeSession(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id: "s1",
    date: "2026-07-06",
    level: 2,
    targetReps: 5,
    roundsPlanned: 1,
    roundsCompleted: 1,
    repsPerRound: [5],
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
});

describe("isHabitDay", () => {
  function settings(habitDaysPerWeek: number): Settings {
    return { ...makeData().settings, habitDaysPerWeek };
  }

  it("7 days per week means every day", () => {
    for (let wd = 0; wd <= 6; wd++) {
      assert.equal(isHabitDay(settings(7), wd), true);
    }
  });

  it("6 days per week skips Sunday", () => {
    assert.equal(isHabitDay(settings(6), 0), false);
    for (let wd = 1; wd <= 6; wd++) {
      assert.equal(isHabitDay(settings(6), wd), true);
    }
  });

  it("5 days per week means weekdays only", () => {
    assert.equal(isHabitDay(settings(5), 0), false);
    assert.equal(isHabitDay(settings(5), 6), false);
    for (let wd = 1; wd <= 5; wd++) {
      assert.equal(isHabitDay(settings(5), wd), true);
    }
  });
});

describe("evaluateHabitWeek", () => {
  // Monday July 6, 2026; previous week is June 29 - July 5
  const monday = new Date(2026, 6, 6);
  const prevWeek = ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];

  function habit(date: string, rpe: number | null): SessionEntry {
    return makeSession({ id: `h-${date}`, date, rpe });
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

  it("keeps reps unchanged when there were no sessions", () => {
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

  it("ignores sessions outside the previous week", () => {
    const data = makeData({
      roundRepsHabit: 5,
      lastHabitWeekEvaluated: "2026-06-29",
      sessions: [
        habit("2026-06-28", 10), // week before previous
        habit("2026-07-06", 10), // current week
      ],
    });
    const out = evaluateHabitWeek(data, monday);
    assert.ok(out);
    // no sessions in previous week -> unchanged
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
  it("never allows level up at the top level", () => {
    const data = makeData({
      level: 3,
      maxTests: [{ date: "2026-07-01", level: 3, reps: 30 }],
    });
    assert.equal(canLevelUp(data), false);
  });

  it("requires the latest max test to reach the threshold", () => {
    const below = makeData({
      level: 2,
      maxTests: [{ date: "2026-07-01", level: 2, reps: 7 }],
    });
    assert.equal(canLevelUp(below), false);

    const at = makeData({
      level: 2,
      maxTests: [{ date: "2026-07-01", level: 2, reps: 8 }],
    });
    assert.equal(canLevelUp(at), true);
  });

  it("uses the latest test at the current level, not the best", () => {
    const data = makeData({
      level: 2,
      maxTests: [
        { date: "2026-06-01", level: 2, reps: 10 },
        { date: "2026-07-01", level: 2, reps: 6 },
      ],
    });
    assert.equal(canLevelUp(data), false);
  });

  it("ignores max tests from other levels", () => {
    const data = makeData({
      level: 2,
      maxTests: [{ date: "2026-07-01", level: 1, reps: 20 }],
    });
    assert.equal(canLevelUp(data), false);
  });

  it("requires at least one max test at the current level", () => {
    const data = makeData({ level: 2, maxTests: [] });
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
