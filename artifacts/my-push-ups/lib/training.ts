import type {
  AppData,
  HealthAnswers,
  Level,
  MaxTestEntry,
  SessionEntry,
  Settings,
} from "./types";

export const LEVEL_INFO: {
  name: string;
  short: string;
  description: string;
  bestFor: string;
}[] = [
  {
    name: "Wall push-ups",
    short: "Wall",
    description: "Hands on a wall, body at an angle.",
    bestFor: "Best for just getting started",
  },
  {
    name: "Incline push-ups",
    short: "Incline",
    description: "Hands on a counter, bench, or step.",
    bestFor: "Best if wall push-ups feel easy",
  },
  {
    name: "Knee push-ups",
    short: "Knee",
    description: "Knees on the floor, hands under shoulders.",
    bestFor: "Best if you can do a few incline reps",
  },
  {
    name: "Full push-ups",
    short: "Full",
    description: "Standard floor push-ups.",
    bestFor: "Best if you can do 8+ with good form",
  },
];

export const MILESTONES = [10, 20, 30, 50, 75, 100];
export const RETEST_DAYS = 21;
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// One daily session is 5 rounds (per user request), with a short rest between
// rounds (spec §4.4: 30–60 s for habit work). The per-round rep target ramps
// up gradually over the days since the last max test — see sessionRoundReps.
export const SESSION_ROUNDS = 5;
export const SESSION_REST_SECONDS = 60;
export const RAMP_STEP_DAYS = 3; // +1 rep per round every 3 days
export const REP_CAP = 15; // spec §4.3 upper bound for habit reps

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

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

export function weekStartKey(d: Date = new Date()): string {
  const day = (d.getDay() + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - day);
  return dateKey(m);
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${`${s}`.padStart(2, "0")}`;
}

// Spec §4.3: base per-round reps = floor(max_reps × 0.4), bounded 3..15.
export function baseRoundReps(maxReps: number): number {
  return clamp(Math.floor(maxReps * 0.4), 3, REP_CAP);
}

export function latestMaxTest(
  data: AppData,
  level: Level,
): MaxTestEntry | null {
  const tests = data.maxTests.filter((t) => t.level === level);
  return tests.length > 0 ? (tests[tests.length - 1] ?? null) : null;
}

export function currentMaxReps(data: AppData): number {
  return latestMaxTest(data, data.level)?.reps ?? 5;
}

// Per-round rep target for a given day. Starts at the base and rises by 1 every
// RAMP_STEP_DAYS days since the last max test for the current level, capped at
// REP_CAP and at the user's tested max. A fresh max test resets the ramp from a
// new (higher) base. Deterministic in the date, so the Plan tab can show the
// whole climbing schedule ahead of time.
export function sessionRoundReps(
  data: AppData,
  onDate: string = dateKey(),
): number {
  const latest = latestMaxTest(data, data.level);
  const maxReps = latest?.reps ?? 5;
  const base = baseRoundReps(maxReps);
  const dayIndex = latest ? Math.max(0, daysBetween(latest.date, onDate)) : 0;
  const step = Math.floor(dayIndex / RAMP_STEP_DAYS);
  const cap = Math.max(3, Math.min(REP_CAP, maxReps));
  return clamp(base + step, 3, cap);
}

// Total reps prescribed for a day's session (all rounds).
export function sessionTotalReps(
  data: AppData,
  onDate: string = dateKey(),
): number {
  return SESSION_ROUNDS * sessionRoundReps(data, onDate);
}

export function daysSinceMaxTest(data: AppData): number | null {
  const last = latestMaxTest(data, data.level);
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

export function bestMax(data: AppData, level: Level): number {
  return data.maxTests
    .filter((t) => t.level === level)
    .reduce((a, t) => Math.max(a, t.reps), 0);
}

export function defaultSettings(goalReps: number): Settings {
  return {
    habitDaysPerWeek: 7,
    goalReps,
    sound: true,
    haptics: true,
    habitReminder: { enabled: false, hour: 7, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] },
  };
}

export function createInitialData(params: {
  level: Level;
  maxReps: number;
  health: HealthAnswers;
  goalReps: number;
}): AppData {
  const { level, maxReps, health, goalReps } = params;
  return {
    onboardingComplete: true,
    level,
    health,
    settings: defaultSettings(goalReps),
    maxTests: [{ date: dateKey(), level, reps: maxReps }],
    sessions: [],
    needsMaxTest: false,
  };
}

const PAIN_VALUES = ["wrist", "shoulder", "chest"];

function isValidMaxTest(t: unknown): t is MaxTestEntry {
  if (typeof t !== "object" || t === null) return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.level === "number" &&
    o.level >= 0 &&
    o.level <= 3 &&
    typeof o.reps === "number" &&
    Number.isFinite(o.reps) &&
    o.reps > 0
  );
}

function isValidSession(s: unknown): s is SessionEntry {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date) &&
    typeof o.level === "number" &&
    o.level >= 0 &&
    o.level <= 3 &&
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

// Accepts current backups as well as legacy ones from earlier app versions:
// unknown fields (roundRepsHabit, lastHabitWeekEvaluated, strength-track data,
// per-session `track`, …) are dropped, and old sessions are kept as plain
// history so streaks and stats survive.
export function sanitizeImport(raw: unknown): AppData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  if (
    typeof o.level !== "number" ||
    o.level < 0 ||
    o.level > 3 ||
    !Number.isInteger(o.level)
  ) {
    return null;
  }
  const level = o.level as Level;

  if (!Array.isArray(o.maxTests) || !Array.isArray(o.sessions)) return null;
  const maxTests: MaxTestEntry[] = (o.maxTests as unknown[])
    .filter(isValidMaxTest)
    .map((t) => ({
      date: t.date,
      level: Math.floor(t.level) as Level,
      reps: clamp(Math.floor(t.reps), 1, 999),
    }));
  if (maxTests.length === 0) return null;

  const sessions: SessionEntry[] = (o.sessions as unknown[])
    .filter(isValidSession)
    .map((s) => ({
      id: typeof (s as SessionEntry).id === "string" ? (s as SessionEntry).id : newId(),
      date: s.date,
      level: Math.floor(s.level) as Level,
      targetReps: clamp(Math.floor(s.targetReps), 0, 999),
      roundsPlanned: clamp(Math.floor(s.roundsPlanned), 0, 20),
      roundsCompleted: clamp(Math.floor(s.roundsCompleted), 0, 20),
      repsPerRound: s.repsPerRound
        .slice(0, 20)
        .map((r) => clamp(Math.floor(r), 0, 999)),
      rpe:
        typeof s.rpe === "number" && s.rpe >= 1 && s.rpe <= 10
          ? Math.round(s.rpe)
          : null,
      painFlags: Array.isArray(s.painFlags)
        ? (s.painFlags.filter((p) =>
            PAIN_VALUES.includes(p as string),
          ) as SessionEntry["painFlags"])
        : [],
    }));

  const def = defaultSettings(50);
  const so =
    typeof o.settings === "object" && o.settings !== null
      ? (o.settings as Record<string, unknown>)
      : {};
  const settings: Settings = {
    habitDaysPerWeek: [5, 6, 7].includes(numOr(so.habitDaysPerWeek, 7))
      ? (numOr(so.habitDaysPerWeek, 7) as number)
      : 7,
    goalReps: clamp(Math.floor(numOr(so.goalReps, def.goalReps)), 1, 999),
    sound: boolOr(so.sound, true),
    haptics: boolOr(so.haptics, true),
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

  return {
    onboardingComplete: true,
    level,
    health,
    settings,
    maxTests,
    sessions,
    needsMaxTest: boolOr(o.needsMaxTest, false),
  };
}

export function newId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}
