import { clamp } from "@/lib/core";

// ============================================================================
// Strength-oriented push-up engine.
//
// Implements pushup_strength_methodology.md: round targets are a fraction of the
// user's current max, shaped across a fixed 7-day microcycle (5 progressive days
// with small cumulative bumps, a hold day, then a lighter technical day). Real
// progression comes from periodic max re-tests raising the max, not from the
// intra-week bumps. There is no fitness-level ladder — one max number drives
// everything.
//
// Where the spec's prose and its worked examples disagree, this follows the
// examples (self-consistent across all three example weeks) and the explicit
// Step 1–4 rules; deviations are noted inline.
//
// This is *one exercise's* engine, not a shared framework — a second exercise
// brings its own planForDay rather than parameterising this one.
// ============================================================================

export const MILESTONES = [10, 20, 30, 50, 75, 100];

export const SESSION_ROUNDS = 5;
export const MICROCYCLE_DAYS = 7;

// Per-round rep band (methodology §Step 2): a 3-rep safety floor and a
// ceiling of floor(0.70 × max) keep every set clearly submaximal.
export const MIN_ROUND_REPS = 3;
export const CAP_FRACTION = 0.7;

// Re-test cadence: the spec allows "every 7–14 days (configurable)". 14 is the
// calmer end — a max-effort test every week is a lot to ask of a real user.
export const RETEST_DAYS = 14;

export const MAX_REST_SECONDS = 180; // strength rest can run to ~3 min (§Core)
export const DEFAULT_REST_SECONDS = 90;

// Base intensities as a fraction of current max, per round (§Step 1).
export const BASE_PCT = [0.6, 0.6, 0.55, 0.55, 0.5];
// Technical / light day, microcycle day 7 (§Step 3).
export const TECHNICAL_PCT = [0.5, 0.5, 0.45, 0.45, 0.4];

// Cumulative per-round bumps across the progressive days, taken from the worked
// examples: +R5 on day 2, +R1 on day 3, +R2 on day 4, +R3 on day 5 (Round 4 is
// never bumped inside a cycle). Index = round, value = reps added by that
// microcycle position. Day 6 (hold) reuses day 5; day 7 (technical) has its own
// percentages and no bump. The beginner example's cosmetic day-1 R5 taper is not
// applied — the intermediate example confirms it isn't a rule.
const INCREMENTS: Record<number, number[]> = {
  1: [0, 0, 0, 0, 0],
  2: [0, 0, 0, 0, 1],
  3: [1, 0, 0, 0, 1],
  4: [1, 1, 0, 0, 1],
  5: [1, 1, 1, 0, 1],
  6: [1, 1, 1, 0, 1],
};

export type DayType = "progressive" | "hold" | "technical";

// "technical" stays the internal name (it's the methodology's term), but users
// read it as a deload — "Light" says what the day actually asks of them.
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  progressive: "Build",
  hold: "Hold",
  technical: "Light",
};

/** One line explaining why today's numbers look the way they do. */
export const DAY_TYPE_HINT: Record<DayType, string> = {
  progressive:
    "A build day — targets creep up a rep at a time. Keep every set well short of failure.",
  hold: "A hold day — same numbers as yesterday. Repeating the load is what makes it stick.",
  technical:
    "A light day — targets drop on purpose so you recover and drill clean form before the cycle restarts.",
};

export const DAY_TYPE_ICON: Record<DayType, string> = {
  progressive: "trending-up",
  hold: "repeat",
  technical: "feather",
};

export interface PushupDayPlan {
  dayNumber: number; // global microcycle counter (1-based)
  microPos: number; // position within the 7-day cycle (1..7)
  type: DayType;
  rounds: number[]; // 5 per-round targets
  total: number;
}

// --- Round & microcycle maths -------------------------------------------------

// One round's reps: floor(pct × max), held inside the strength band
// [MIN_ROUND_REPS, floor(CAP × max)]. The 3-rep floor wins for very low maxes,
// where the cap would otherwise fall below it. Below a max of 3 the app can't
// prescribe anything submaximal, so every round is simply the max (§Step 2).
export function roundRepFromPct(pct: number, max: number): number {
  if (max < MIN_ROUND_REPS) return Math.max(0, Math.floor(max));
  const cap = Math.max(MIN_ROUND_REPS, Math.floor(CAP_FRACTION * max));
  return clamp(Math.floor(pct * max), MIN_ROUND_REPS, cap);
}

// Position within the 7-day microcycle for a 1-based global day counter.
export function microPosOf(dayNumber: number): number {
  const n = Math.max(1, Math.floor(dayNumber));
  return ((n - 1) % MICROCYCLE_DAYS) + 1;
}

export function dayTypeFor(dayNumber: number): DayType {
  const pos = microPosOf(dayNumber);
  if (pos === MICROCYCLE_DAYS) return "technical";
  return pos === 6 ? "hold" : "progressive";
}

// The full prescription for a microcycle day, from the current max.
export function planForDay(max: number, dayNumber: number): PushupDayPlan {
  const microPos = microPosOf(dayNumber);
  const type = dayTypeFor(dayNumber);

  let rounds: number[];
  if (type === "technical") {
    rounds = TECHNICAL_PCT.map((p) => roundRepFromPct(p, max));
  } else {
    const inc = INCREMENTS[microPos] ?? INCREMENTS[1]!;
    const cap = Math.max(MIN_ROUND_REPS, Math.floor(CAP_FRACTION * max));
    rounds = BASE_PCT.map((p, i) => {
      const bumped = roundRepFromPct(p, max) + (inc[i] ?? 0);
      // Re-clamp after the bump so a bumped round can't break the band.
      if (max < MIN_ROUND_REPS) return Math.max(0, Math.floor(max));
      return clamp(bumped, MIN_ROUND_REPS, cap);
    });
  }

  return {
    dayNumber,
    microPos,
    type,
    rounds,
    total: rounds.reduce((a, b) => a + b, 0),
  };
}

// Advance the microcycle by one — called only when a session is completed, so a
// skipped calendar day leaves the same prescription in place (§Step 5).
export function advanceDayNumber(dayNumber: number): number {
  return Math.max(1, Math.floor(dayNumber)) + 1;
}

/**
 * Round a value up to a "nice" axis maximum (5, 10, 20, 50, 100, …). Moved
 * verbatim from RepsChart so a seconds-based exercise can supply its own steps
 * (minutes don't round to powers of ten).
 */
export function axisCeil(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}
