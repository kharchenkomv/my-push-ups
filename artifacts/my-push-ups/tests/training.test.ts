import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  baseRoundReps,
  clamp,
  createInitialData,
  currentMaxReps,
  currentStreak,
  dateKey,
  daysBetween,
  formatSeconds,
  isHabitDay,
  keyToDate,
  maxTestDue,
  sessionRoundReps,
  sessionTotalReps,
  weekStartKey,
  SESSION_ROUNDS,
} from "../lib/training";
import type { AppData, SessionEntry, Settings } from "../lib/types";

function makeSession(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id: "s1",
    date: "2026-07-06",
    level: 2,
    targetReps: 5,
    roundsPlanned: SESSION_ROUNDS,
    roundsCompleted: SESSION_ROUNDS,
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

// Data whose only max test is at `date` with `reps`, so ramp math is exact.
function dataWithTest(date: string, reps: number, level: 0 | 1 | 2 | 3 = 2): AppData {
  return makeData({ level, maxTests: [{ date, level, reps }] });
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

  it("daysBetween counts calendar days across a DST transition", () => {
    assert.equal(daysBetween("2026-07-01", "2026-07-08"), 7);
    assert.equal(daysBetween("2026-07-08", "2026-07-01"), -7);
    assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
  });

  it("weekStartKey returns the Monday of the week", () => {
    assert.equal(weekStartKey(new Date(2026, 6, 6)), "2026-07-06");
    assert.equal(weekStartKey(new Date(2026, 6, 12)), "2026-07-06");
    assert.equal(weekStartKey(new Date(2026, 6, 13)), "2026-07-13");
  });

  it("formatSeconds renders m:ss", () => {
    assert.equal(formatSeconds(0), "0:00");
    assert.equal(formatSeconds(60), "1:00");
    assert.equal(formatSeconds(125), "2:05");
  });

  it("clamp bounds values", () => {
    assert.equal(clamp(5, 1, 10), 5);
    assert.equal(clamp(-5, 1, 10), 1);
    assert.equal(clamp(50, 1, 10), 10);
  });
});

describe("baseRoundReps", () => {
  it("takes 40% of max, clamped 3..15", () => {
    assert.equal(baseRoundReps(10), 4);
    assert.equal(baseRoundReps(20), 8);
    assert.equal(baseRoundReps(2), 3); // floor(0.8)=0 -> min 3
    assert.equal(baseRoundReps(100), 15); // capped
  });
});

describe("sessionRoundReps (daily ramp)", () => {
  it("starts at the base on the max-test day", () => {
    const data = dataWithTest("2026-07-01", 20); // base = 8
    assert.equal(sessionRoundReps(data, "2026-07-01"), 8);
  });

  it("rises by 1 every 3 days", () => {
    const data = dataWithTest("2026-07-01", 20); // base 8, cap 15
    assert.equal(sessionRoundReps(data, "2026-07-01"), 8); // day 0
    assert.equal(sessionRoundReps(data, "2026-07-02"), 8); // day 1
    assert.equal(sessionRoundReps(data, "2026-07-03"), 8); // day 2
    assert.equal(sessionRoundReps(data, "2026-07-04"), 9); // day 3
    assert.equal(sessionRoundReps(data, "2026-07-07"), 10); // day 6
    assert.equal(sessionRoundReps(data, "2026-07-10"), 11); // day 9
  });

  it("caps at 15 and never exceeds it", () => {
    const data = dataWithTest("2026-07-01", 40); // base 15 already
    assert.equal(sessionRoundReps(data, "2026-07-01"), 15);
    assert.equal(sessionRoundReps(data, "2026-08-01"), 15);
  });

  it("caps at the tested max when max is below 15", () => {
    const data = dataWithTest("2026-07-01", 10); // base 4, cap min(15,10)=10
    assert.equal(sessionRoundReps(data, "2026-07-01"), 4);
    // day 18 -> +6 -> 10 (at cap); day 30 stays 10
    assert.equal(sessionRoundReps(data, "2026-07-19"), 10);
    assert.equal(sessionRoundReps(data, "2026-08-15"), 10);
  });

  it("falls back to a base of 3 (max 5) when there is no test for the level", () => {
    const data = makeData({ level: 1, maxTests: [] });
    assert.equal(currentMaxReps(data), 5);
    assert.equal(sessionRoundReps(data, "2026-07-01"), 3); // floor(5*0.4)=2 -> 3
  });

  it("sessionTotalReps multiplies by the round count", () => {
    const data = dataWithTest("2026-07-01", 20);
    assert.equal(
      sessionTotalReps(data, "2026-07-04"),
      SESSION_ROUNDS * sessionRoundReps(data, "2026-07-04"),
    );
  });

  it("a fresh, higher max test resets the ramp from a higher base", () => {
    const data = makeData({
      level: 2,
      maxTests: [
        { date: "2026-06-01", level: 2, reps: 10 },
        { date: "2026-07-01", level: 2, reps: 25 },
      ],
    });
    // latest test (reps 25) drives it: base = 10, day 0 on 2026-07-01
    assert.equal(sessionRoundReps(data, "2026-07-01"), 10);
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

describe("streak and max test scheduling", () => {
  it("currentStreak counts consecutive days ending today", () => {
    const sessions = [
      makeSession({ id: "a", date: "2026-07-04" }),
      makeSession({ id: "b", date: "2026-07-05" }),
      makeSession({ id: "c", date: "2026-07-06" }),
    ];
    assert.equal(currentStreak(sessions, "2026-07-06"), 3);
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
    assert.equal(
      maxTestDue(makeData({ maxTests: [{ date: addDays(today, -20), level: 2, reps: 10 }] })),
      false,
    );
    assert.equal(
      maxTestDue(makeData({ maxTests: [{ date: addDays(today, -21), level: 2, reps: 10 }] })),
      true,
    );
    assert.equal(maxTestDue(makeData({ maxTests: [] })), true);
  });
});
