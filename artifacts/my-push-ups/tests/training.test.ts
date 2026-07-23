import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  advanceDayNumber,
  bestMax,
  clamp,
  createInitialData,
  currentMaxReps,
  currentStreak,
  dateKey,
  dayTypeFor,
  daysBetween,
  formatSeconds,
  isHabitDay,
  keyToDate,
  maxTestDue,
  microPosOf,
  planForDay,
  roundRepFromPct,
  weekdayOf,
  MICROCYCLE_DAYS,
  MIN_ROUND_REPS,
  RETEST_DAYS,
  SESSION_ROUNDS,
} from "../lib/training";
import type { AppData, SessionEntry, Settings } from "../lib/types";

function makeData(overrides: Partial<AppData> = {}): AppData {
  const base = createInitialData({
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
    targetReps: 12,
    roundsPlanned: SESSION_ROUNDS,
    roundsCompleted: SESSION_ROUNDS,
    repsPerRound: [12, 12, 11, 11, 10],
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

  it("formatSeconds renders m:ss", () => {
    assert.equal(formatSeconds(45), "0:45");
    assert.equal(formatSeconds(90), "1:30");
    assert.equal(formatSeconds(180), "3:00");
  });

  it("clamp bounds values", () => {
    assert.equal(clamp(50, 1, 10), 10);
    assert.equal(clamp(-5, 1, 10), 1);
  });

  it("weekdayOf reads the weekday", () => {
    assert.equal(weekdayOf("2026-07-06"), 1); // Monday
  });
});

describe("roundRepFromPct (methodology §Step 2)", () => {
  it("is floor(pct × max) inside the strength band", () => {
    assert.equal(roundRepFromPct(0.6, 25), 15);
    assert.equal(roundRepFromPct(0.55, 25), 13); // floor(13.75)
    assert.equal(roundRepFromPct(0.5, 25), 12); // floor(12.5)
  });

  it("caps each round at floor(0.70 × max)", () => {
    // A high fraction is pulled back to the 70% ceiling.
    assert.equal(roundRepFromPct(0.9, 20), 14); // floor(0.7*20)=14, not 18
  });

  it("applies the 3-rep floor, which wins over a sub-3 cap", () => {
    // max 4: cap floor(2.8)=2, but the 3-rep safety floor takes precedence.
    assert.equal(roundRepFromPct(0.5, 4), 3);
    assert.equal(roundRepFromPct(0.6, 5), 3); // floor(3)=3
  });

  it("returns the max itself when max is below 3", () => {
    assert.equal(roundRepFromPct(0.6, 2), 2);
    assert.equal(roundRepFromPct(0.5, 1), 1);
  });
});

describe("microcycle position & day type", () => {
  it("wraps a 1-based day counter into 1..7", () => {
    assert.equal(microPosOf(1), 1);
    assert.equal(microPosOf(7), 7);
    assert.equal(microPosOf(8), 1);
    assert.equal(microPosOf(11), 4);
    assert.equal(microPosOf(14), 7);
  });

  it("labels progressive / hold / technical days", () => {
    for (const p of [1, 2, 3, 4, 5]) {
      assert.equal(dayTypeFor(p), "progressive");
    }
    assert.equal(dayTypeFor(6), "hold");
    assert.equal(dayTypeFor(7), "technical");
    assert.equal(dayTypeFor(13), "hold"); // pos 6
  });
});

describe("planForDay (methodology §Step 1–3)", () => {
  // The intermediate worked example (max = 25) has no first-day taper, so it
  // matches the algorithm exactly for days 1–6.
  const max = 25;

  it("day 1 is the plain base prescription", () => {
    const p = planForDay(max, 1);
    assert.equal(p.type, "progressive");
    assert.equal(p.microPos, 1);
    assert.deepEqual(p.rounds, [15, 15, 13, 13, 12]);
    assert.equal(p.total, 68);
  });

  it("progressive days add the cumulative bumps from the examples", () => {
    assert.deepEqual(planForDay(max, 2).rounds, [15, 15, 13, 13, 13]); // +R5
    assert.deepEqual(planForDay(max, 3).rounds, [16, 15, 13, 13, 13]); // +R1
    assert.deepEqual(planForDay(max, 4).rounds, [16, 16, 13, 13, 13]); // +R2
    assert.deepEqual(planForDay(max, 5).rounds, [16, 16, 14, 13, 13]); // +R3
  });

  it("day 6 holds at the day-5 values", () => {
    assert.deepEqual(planForDay(max, 6).rounds, planForDay(max, 5).rounds);
    assert.equal(planForDay(max, 6).type, "hold");
  });

  it("day 7 is a lighter technical day", () => {
    const p = planForDay(max, 7);
    assert.equal(p.type, "technical");
    assert.deepEqual(p.rounds, [12, 12, 11, 11, 10]); // 50/50/45/45/40, floored
    assert.ok(p.total < planForDay(max, 6).total);
  });

  it("matches the beginner technical day exactly (max 10)", () => {
    assert.deepEqual(planForDay(10, 7).rounds, [5, 5, 4, 4, 4]);
  });

  it("always yields 5 rounds and honours the bands at low max", () => {
    for (let pos = 1; pos <= 7; pos++) {
      const p = planForDay(4, pos);
      assert.equal(p.rounds.length, SESSION_ROUNDS);
      // cap floor(0.7*4)=2 is below the 3-floor, so everything sits at 3.
      assert.ok(p.rounds.every((r) => r === MIN_ROUND_REPS));
    }
  });

  it("re-clamps so an increment cannot break the cap", () => {
    // max 8: cap floor(5.6)=5. Base R1 floor(4.8)=4, +1 = 5 (at cap, not over).
    assert.ok(planForDay(8, 5).rounds.every((r) => r <= 5 && r >= MIN_ROUND_REPS));
  });
});

describe("advanceDayNumber", () => {
  it("advances by one and never drops below 2", () => {
    assert.equal(advanceDayNumber(1), 2);
    assert.equal(advanceDayNumber(7), 8); // 8 wraps to microPos 1
    assert.equal(microPosOf(advanceDayNumber(7)), 1);
  });
});

describe("max, streak & re-test scheduling", () => {
  it("currentMaxReps / bestMax read the max tests", () => {
    const data = makeData({
      maxTests: [
        { date: "2026-06-01", reps: 18 },
        { date: "2026-06-15", reps: 22 },
        { date: "2026-06-29", reps: 20 },
      ],
    });
    assert.equal(currentMaxReps(data), 20); // latest
    assert.equal(bestMax(data), 22); // best ever
  });

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

  it("maxTestDue after RETEST_DAYS, not before", () => {
    const today = dateKey();
    assert.equal(
      maxTestDue(makeData({ maxTests: [{ date: addDays(today, -(RETEST_DAYS - 1)), reps: 12 }] })),
      false,
    );
    assert.equal(
      maxTestDue(makeData({ maxTests: [{ date: addDays(today, -RETEST_DAYS), reps: 12 }] })),
      true,
    );
    assert.equal(maxTestDue(makeData({ maxTests: [] })), true);
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

describe("createInitialData", () => {
  it("starts at microcycle day 1 with one max test", () => {
    const d = makeData();
    assert.equal(d.dayNumber, 1);
    assert.equal(d.maxTests.length, 1);
    assert.equal(d.maxTests[0]?.reps, 20);
    assert.equal(d.sessions.length, 0);
    assert.equal(MICROCYCLE_DAYS, 7);
  });
});
