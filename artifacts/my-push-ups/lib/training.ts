import type {
  AppData,
  HealthAnswers,
  MaxTestEntry,
  SessionEntry,
  Settings,
} from "./types";

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
// ============================================================================

export const MILESTONES = [10, 20, 30, 50, 75, 100];
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  progressive: "Progressive",
  hold: "Hold",
  technical: "Technical",
};

export interface DayPlan {
  dayNumber: number; // global microcycle counter (1-based)
  microPos: number; // position within the 7-day cycle (1..7)
  type: DayType;
  rounds: number[]; // 5 per-round targets
  total: number;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// --- Date helpers -------------------------------------------------------------

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function keyToDate(key: string): Date {
  const parts = key.split("-").map(Number);
  return new Date(parts[0] ?? 2026, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (keyToDate(b).getTime() - keyToDate(a).getTime()) / 86400000,
  );
}

export function weekdayOf(key: string): number {
  return keyToDate(key).getDay();
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${`${s}`.padStart(2, "0")}`;
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
export function planForDay(max: number, dayNumber: number): DayPlan {
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

// Today's prescription for the user's data (purely microcycle-based; no calendar
// dependence — the day only advances when a session is logged).
export function planForDate(data: AppData): DayPlan {
  return planForDay(currentMaxReps(data), data.dayNumber);
}

// --- Max test & scheduling ----------------------------------------------------

export function latestMaxTest(data: AppData): MaxTestEntry | null {
  return data.maxTests.length > 0
    ? (data.maxTests[data.maxTests.length - 1] ?? null)
    : null;
}

export function currentMaxReps(data: AppData): number {
  return latestMaxTest(data)?.reps ?? 5;
}

export function bestMax(data: AppData): number {
  return data.maxTests.reduce((a, t) => Math.max(a, t.reps), 0);
}

export function daysSinceMaxTest(data: AppData): number | null {
  const last = latestMaxTest(data);
  if (!last) return null;
  return daysBetween(last.date, dateKey());
}

export function maxTestDue(data: AppData): boolean {
  const days = daysSinceMaxTest(data);
  return days === null || days >= RETEST_DAYS;
}

export function isHabitDay(settings: Settings, weekday: number): boolean {
  const n = settings.habitDaysPerWeek;
  return n >= 7 || (n === 6 ? weekday !== 0 : weekday >= 1 && weekday <= 5);
}

export function sessionOn(
  sessions: SessionEntry[],
  key: string,
): SessionEntry | undefined {
  return sessions.find((s) => s.date === key);
}

// --- Stats --------------------------------------------------------------------

export function currentStreak(
  sessions: SessionEntry[],
  today: string = dateKey(),
): number {
  const days = new Set(sessions.map((s) => s.date));
  let streak = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function recentPainFlags(data: AppData): boolean {
  return data.sessions.slice(-3).some((s) => s.painFlags.length > 0);
}

// --- Construction & persistence ----------------------------------------------

export function defaultSettings(goalReps: number): Settings {
  return {
    habitDaysPerWeek: 7,
    restSeconds: DEFAULT_REST_SECONDS,
    goalReps,
    sound: true,
    habitReminder: {
      enabled: false,
      hour: 7,
      minute: 0,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
  };
}

export function createInitialData(params: {
  maxReps: number;
  health: HealthAnswers;
  goalReps: number;
}): AppData {
  const { maxReps, health, goalReps } = params;
  return {
    onboardingComplete: true,
    health,
    settings: defaultSettings(goalReps),
    maxTests: [{ date: dateKey(), reps: maxReps }],
    sessions: [],
    dayNumber: 1,
    needsMaxTest: false,
  };
}

const PAIN_VALUES = ["wrist", "shoulder", "elbow", "chest"];

function isValidMaxTest(t: unknown): boolean {
  if (typeof t !== "object" || t === null) return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.reps === "number" &&
    Number.isFinite(o.reps) &&
    o.reps > 0
  );
}

function isValidSession(s: unknown): boolean {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.targetReps === "number" &&
    typeof o.roundsPlanned === "number" &&
    typeof o.roundsCompleted === "number" &&
    Array.isArray(o.repsPerRound) &&
    (o.repsPerRound as unknown[]).every((r) => typeof r === "number")
  );
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function sanitizeReminder(
  v: unknown,
  fallback: { enabled: boolean; hour: number; minute: number; days: number[] },
): { enabled: boolean; hour: number; minute: number; days: number[] } {
  if (typeof v !== "object" || v === null) return fallback;
  const o = v as Record<string, unknown>;
  const days = Array.isArray(o.days)
    ? Array.from(
        new Set(
          (o.days as unknown[]).filter(
            (d): d is number =>
              typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6,
          ),
        ),
      ).sort((a, b) => a - b)
    : fallback.days;
  return {
    enabled: boolOr(o.enabled, fallback.enabled),
    hour: clamp(Math.floor(numOr(o.hour, fallback.hour)), 0, 23),
    minute: clamp(Math.floor(numOr(o.minute, fallback.minute)), 0, 59),
    days: days.length > 0 ? days : fallback.days,
  };
}

// Accepts current backups plus older ones. Legacy shapes carried a per-variation
// `level`, a `dailyTarget` scalar and `lastWeekEvaluated` (from the habit-era
// weekday engine); those are dropped, `dayNumber` is synthesized, and old
// sessions/tests are kept as history so streaks and stats survive.
export function sanitizeImport(raw: unknown): AppData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.maxTests) || !Array.isArray(o.sessions)) return null;

  const maxTests: MaxTestEntry[] = (o.maxTests as unknown[])
    .filter(isValidMaxTest)
    .map((t) => {
      const e = t as Record<string, unknown>;
      return {
        date: e.date as string,
        reps: clamp(Math.floor(e.reps as number), 1, 999),
      };
    });
  if (maxTests.length === 0) return null;

  const sessions: SessionEntry[] = (o.sessions as unknown[])
    .filter(isValidSession)
    .map((s) => {
      const e = s as Record<string, unknown>;
      return {
        id: typeof e.id === "string" ? e.id : newId(),
        date: e.date as string,
        targetReps: clamp(Math.floor(e.targetReps as number), 0, 999),
        roundsPlanned: clamp(Math.floor(e.roundsPlanned as number), 0, 20),
        roundsCompleted: clamp(Math.floor(e.roundsCompleted as number), 0, 20),
        repsPerRound: (e.repsPerRound as number[])
          .slice(0, 20)
          .map((r) => clamp(Math.floor(r), 0, 999)),
        rpe:
          typeof e.rpe === "number" && e.rpe >= 1 && e.rpe <= 10
            ? Math.round(e.rpe)
            : null,
        painFlags: Array.isArray(e.painFlags)
          ? (e.painFlags.filter((p) =>
              PAIN_VALUES.includes(p as string),
            ) as SessionEntry["painFlags"])
          : [],
      };
    });

  const def = defaultSettings(50);
  const so =
    typeof o.settings === "object" && o.settings !== null
      ? (o.settings as Record<string, unknown>)
      : {};
  const settings: Settings = {
    habitDaysPerWeek: [5, 6, 7].includes(numOr(so.habitDaysPerWeek, 7))
      ? (numOr(so.habitDaysPerWeek, 7) as number)
      : 7,
    restSeconds: clamp(
      Math.floor(numOr(so.restSeconds, DEFAULT_REST_SECONDS)),
      15,
      MAX_REST_SECONDS,
    ),
    goalReps: clamp(Math.floor(numOr(so.goalReps, def.goalReps)), 1, 999),
    sound: boolOr(so.sound, true),
    habitReminder: sanitizeReminder(so.habitReminder, def.habitReminder),
  };

  const ho =
    typeof o.health === "object" && o.health !== null
      ? (o.health as Record<string, unknown>)
      : {};
  const health: HealthAnswers = {
    cardio: boolOr(ho.cardio, false),
    joints: boolOr(ho.joints, false),
    pain: boolOr(ho.pain, false),
    acknowledged: boolOr(ho.acknowledged, true),
  };

  // Advance the microcycle counter by the number of completed sessions when no
  // valid dayNumber is stored (migrating habit-era data), so returning users
  // don't restart the cycle from scratch.
  const storedDay = numOr(o.dayNumber, NaN);
  const dayNumber =
    Number.isFinite(storedDay) && storedDay >= 1
      ? Math.floor(storedDay)
      : Math.max(1, sessions.length + 1);

  return {
    onboardingComplete: true,
    health,
    settings,
    maxTests,
    sessions,
    dayNumber,
    needsMaxTest: boolOr(o.needsMaxTest, false),
  };
}

export function newId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}
