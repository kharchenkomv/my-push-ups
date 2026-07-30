import { clamp, currentStreak, dateKey, daysBetween, newId } from "./core";
import { DEFAULT_EXERCISE_ID, EXERCISES, EXERCISE_IDS } from "./exercises";
import type { DayMeta, DayPlan, ExerciseDef } from "./exercises/types";
import {
  PAIN_FLAGS,
  SCHEMA_VERSION,
  type AppData,
  type ExerciseId,
  type ExerciseSettings,
  type ExerciseState,
  type HealthAnswers,
  type MaxTestEntry,
  type PainFlag,
  type SessionEntry,
  type Settings,
} from "./types";

// ============================================================================
// Persisted-state construction, validation/migration, and pure selectors.
//
// Everything here is React-free so the whole derivation layer is testable under
// node — the UI hooks are thin wrappers over `selectExercise`.
// ============================================================================

const MIN_REST_SECONDS = 15;

// --- Per-exercise selectors ---------------------------------------------------

export function latestMaxTest(s: ExerciseState): MaxTestEntry | null {
  return s.maxTests.length > 0 ? (s.maxTests[s.maxTests.length - 1] ?? null) : null;
}

export function currentMax(def: ExerciseDef, s: ExerciseState): number {
  return latestMaxTest(s)?.value ?? def.engine.defaultMax;
}

export function bestMax(s: ExerciseState): number {
  return s.maxTests.reduce((a, t) => Math.max(a, t.value), 0);
}

export function daysSinceMaxTest(
  s: ExerciseState,
  today: string = dateKey(),
): number | null {
  const last = latestMaxTest(s);
  return last ? daysBetween(last.date, today) : null;
}

export function maxTestDue(
  def: ExerciseDef,
  s: ExerciseState,
  today: string = dateKey(),
): boolean {
  const days = daysSinceMaxTest(s, today);
  return days === null || days >= def.engine.retestDays;
}

export function sessionOn(s: ExerciseState, key: string): SessionEntry | undefined {
  return s.sessions.find((x) => x.date === key);
}

export function recentPain(s: ExerciseState): boolean {
  return s.sessions.slice(-3).some((x) => x.painFlags.length > 0);
}

/** Today's prescription — cycle-based, so a skipped day repeats it unchanged. */
export function planFor(def: ExerciseDef, s: ExerciseState): DayPlan {
  return def.engine.planForDay(currentMax(def, s), s.dayNumber);
}

export function isHabitDay(settings: Settings, weekday: number): boolean {
  const n = settings.habitDaysPerWeek;
  return n >= 7 || (n === 6 ? weekday !== 0 : weekday >= 1 && weekday <= 5);
}

// --- Cross-exercise selectors -------------------------------------------------

export function enabledIds(data: AppData): ExerciseId[] {
  return EXERCISE_IDS.filter((id) => data.exercises[id]?.enabled);
}

/** Every day on which *some* enabled exercise was trained. */
export function trainedDates(data: AppData): string[] {
  const out = new Set<string>();
  for (const id of enabledIds(data)) {
    for (const s of data.exercises[id].sessions) out.add(s.date);
  }
  return [...out];
}

/** Streak over the union of enabled exercises — identical to one track's own at N=1. */
export function overallStreak(data: AppData, today: string = dateKey()): number {
  return currentStreak(
    trainedDates(data).map((date) => ({ date })),
    today,
  );
}

/** Everything a screen needs about one track, derived in one place. */
export interface ExerciseSnapshot {
  id: ExerciseId;
  def: ExerciseDef;
  state: ExerciseState;
  plan: DayPlan;
  dayMeta: DayMeta;
  currentMax: number;
  bestMax: number;
  daysSinceMaxTest: number | null;
  testDue: boolean;
  doneToday: SessionEntry | undefined;
  streak: number;
  recentPain: boolean;
}

export function selectExercise(
  data: AppData,
  id: ExerciseId,
  today: string = dateKey(),
): ExerciseSnapshot {
  const def = EXERCISES[id];
  const state = data.exercises[id];
  const plan = planFor(def, state);
  return {
    id,
    def,
    state,
    plan,
    dayMeta: def.engine.dayMeta(plan),
    currentMax: currentMax(def, state),
    bestMax: bestMax(state),
    daysSinceMaxTest: daysSinceMaxTest(state, today),
    testDue: state.needsMaxTest || maxTestDue(def, state, today),
    doneToday: sessionOn(state, today),
    streak: currentStreak(state.sessions, today),
    recentPain: recentPain(state),
  };
}

// --- Construction -------------------------------------------------------------

export function defaultSettings(): Settings {
  return {
    habitDaysPerWeek: 7,
    sound: true,
    habitReminder: {
      enabled: false,
      hour: 7,
      minute: 0,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
  };
}

/** A dormant track: registered, never calibrated, invisible until enabled. */
export function emptyExerciseState(id: ExerciseId): ExerciseState {
  const def = EXERCISES[id];
  return {
    enabled: false,
    settings: { restSeconds: def.defaultRestSeconds },
    maxTests: [],
    sessions: [],
    dayNumber: 1,
    needsMaxTest: true,
  };
}

function emptyExercises(): Record<ExerciseId, ExerciseState> {
  return Object.fromEntries(
    EXERCISE_IDS.map((id) => [id, emptyExerciseState(id)]),
  ) as Record<ExerciseId, ExerciseState>;
}

export function createInitialData(params: {
  maxValue: number;
  health: HealthAnswers;
  exerciseId?: ExerciseId;
}): AppData {
  const { maxValue, health } = params;
  const id = params.exerciseId ?? DEFAULT_EXERCISE_ID;
  const exercises = emptyExercises();
  exercises[id] = {
    ...exercises[id],
    enabled: true,
    maxTests: [{ date: dateKey(), value: maxValue }],
    needsMaxTest: false,
  };
  return {
    version: SCHEMA_VERSION,
    onboardingComplete: true,
    health,
    settings: defaultSettings(),
    exercises,
  };
}

// --- Validation helpers -------------------------------------------------------

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Reads both the v2 (`value`) and v1 (`reps`) spellings — forever. */
function readValue(o: Record<string, unknown>, v2: string, v1: string): unknown {
  return o[v2] !== undefined ? o[v2] : o[v1];
}

function sanitizeMaxTests(raw: unknown): MaxTestEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      const o = obj(t);
      const value = readValue(o, "value", "reps");
      if (!isDateKey(o.date) || typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return null;
      }
      return { date: o.date, value: clamp(Math.floor(value), 1, 999) };
    })
    .filter((t): t is MaxTestEntry => t !== null);
}

function sanitizeSessions(raw: unknown): SessionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const o = obj(s);
      const target = readValue(o, "targetValue", "targetReps");
      const perRound = readValue(o, "valuePerRound", "repsPerRound");
      if (
        !isDateKey(o.date) ||
        typeof target !== "number" ||
        typeof o.roundsPlanned !== "number" ||
        typeof o.roundsCompleted !== "number" ||
        !Array.isArray(perRound) ||
        !perRound.every((r) => typeof r === "number")
      ) {
        return null;
      }
      return {
        id: typeof o.id === "string" ? o.id : newId(),
        date: o.date,
        targetValue: clamp(Math.floor(target), 0, 999),
        roundsPlanned: clamp(Math.floor(o.roundsPlanned), 0, 20),
        roundsCompleted: clamp(Math.floor(o.roundsCompleted), 0, 20),
        valuePerRound: (perRound as number[])
          .slice(0, 20)
          .map((r) => clamp(Math.floor(r), 0, 999)),
        rpe:
          typeof o.rpe === "number" && o.rpe >= 1 && o.rpe <= 10
            ? Math.round(o.rpe)
            : null,
        painFlags: Array.isArray(o.painFlags)
          ? (o.painFlags.filter((p) =>
              (PAIN_FLAGS as readonly string[]).includes(p as string),
            ) as PainFlag[])
          : [],
      };
    })
    .filter((s): s is SessionEntry => s !== null);
}

function sanitizeReminder(v: unknown, fallback: Settings["habitReminder"]) {
  const o = obj(v);
  if (typeof v !== "object" || v === null) return fallback;
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

function sanitizeExerciseSettings(
  id: ExerciseId,
  raw: unknown,
): ExerciseSettings {
  const def = EXERCISES[id];
  const o = obj(raw);
  return {
    restSeconds: clamp(
      Math.floor(numOr(o.restSeconds, def.defaultRestSeconds)),
      MIN_REST_SECONDS,
      def.maxRestSeconds,
    ),
  };
}

function sanitizeGlobalSettings(raw: unknown): Settings {
  const fallback = defaultSettings();
  const o = obj(raw);
  const days = numOr(o.habitDaysPerWeek, 7);
  return {
    habitDaysPerWeek: [5, 6, 7].includes(days) ? days : 7,
    sound: boolOr(o.sound, true),
    habitReminder: sanitizeReminder(o.habitReminder, fallback.habitReminder),
  };
}

function sanitizeHealth(raw: unknown): HealthAnswers {
  const o = obj(raw);
  return {
    cardio: boolOr(o.cardio, false),
    joints: boolOr(o.joints, false),
    pain: boolOr(o.pain, false),
    acknowledged: boolOr(o.acknowledged, true),
  };
}

/**
 * Build one track's state from a raw blob plus the settings source it should
 * read (v1 keeps rest/goal on the global settings object; v2 has its own).
 */
function buildExerciseState(
  id: ExerciseId,
  raw: unknown,
  settingsSource: unknown,
): ExerciseState {
  const o = obj(raw);
  const maxTests = sanitizeMaxTests(o.maxTests);
  const sessions = sanitizeSessions(o.sessions);

  // Advance the cycle counter by the number of completed sessions when no valid
  // dayNumber is stored (habit-era data), so returning users don't restart.
  const stored = numOr(o.dayNumber, NaN);
  const dayNumber =
    Number.isFinite(stored) && stored >= 1
      ? Math.floor(stored)
      : Math.max(1, sessions.length + 1);

  return {
    // A track with history is enabled unless it says otherwise; a v1 blob has
    // no `enabled` key at all and must come back on.
    enabled: boolOr(o.enabled, maxTests.length > 0),
    settings: sanitizeExerciseSettings(id, settingsSource),
    maxTests,
    sessions,
    dayNumber,
    needsMaxTest: boolOr(o.needsMaxTest, maxTests.length === 0),
  };
}

/**
 * Accepts every shape the app has ever written:
 *   v2 — `exercises` map, unit-neutral field names
 *   v1 — single top-level track, `reps`-named fields
 *   v0 — v1 plus habit-era junk (`level`, `dailyTarget`, `lastWeekEvaluated`)
 *
 * Unknown keys are ignored rather than rejected, so a downgrade can't be made
 * fatal by a field a future build added. Returns null only when there is no
 * usable training history at all.
 */
export function sanitizeImport(raw: unknown): AppData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const exercises = emptyExercises();
  const health = sanitizeHealth(o.health);
  const settings = sanitizeGlobalSettings(o.settings);

  if (typeof o.exercises === "object" && o.exercises !== null) {
    // --- v2: per-exercise map. Unknown ids are dropped by construction, since
    // we only ever read the registered ones.
    const src = obj(o.exercises);
    for (const id of EXERCISE_IDS) {
      if (src[id] === undefined) continue; // stays the seeded dormant state
      exercises[id] = buildExerciseState(id, src[id], obj(src[id]).settings);
    }
  } else if (Array.isArray(o.maxTests) || Array.isArray(o.sessions)) {
    // --- v1/v0: one top-level track, which is always push-ups. Rest and goal
    // lived on the global settings object back then.
    exercises[DEFAULT_EXERCISE_ID] = buildExerciseState(
      DEFAULT_EXERCISE_ID,
      o,
      o.settings,
    );
  } else {
    return null;
  }

  // Usable only if at least one track is actually calibrated.
  const anyCalibrated = EXERCISE_IDS.some(
    (id) => exercises[id].maxTests.length > 0,
  );
  if (!anyCalibrated) return null;

  return {
    version: SCHEMA_VERSION,
    onboardingComplete: true,
    health,
    settings,
    exercises,
  };
}
