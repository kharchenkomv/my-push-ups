export const PAIN_FLAGS = ["wrist", "shoulder", "elbow", "chest"] as const;
/** Derived from the const list so the runtime validator and the type can't drift. */
export type PainFlag = (typeof PAIN_FLAGS)[number];

/** Registered training tracks. Adding an exercise starts by widening this. */
export type ExerciseId = "pushups";

/** On-disk schema version. Bumped when the persisted shape changes. */
export const SCHEMA_VERSION = 2;

export interface HealthAnswers {
  cardio: boolean;
  joints: boolean;
  pain: boolean;
  acknowledged: boolean;
}

export interface ReminderConfig {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
}

/** Global preferences, independent of any one exercise. */
export interface Settings {
  habitDaysPerWeek: number;
  sound: boolean;
  habitReminder: ReminderConfig;
}

/** Preferences that belong to a single training track. */
export interface ExerciseSettings {
  restSeconds: number;
}

export interface MaxTestEntry {
  date: string;
  /** Unit-neutral: reps for push-ups, seconds for a timed hold. */
  value: number;
}

export interface SessionEntry {
  id: string;
  date: string;
  targetValue: number;
  roundsPlanned: number;
  roundsCompleted: number;
  /** Unit-neutral per-round results, in the exercise's own unit. */
  valuePerRound: number[];
  rpe: number | null;
  painFlags: PainFlag[];
}

/**
 * One independent training track. Each exercise carries its own calibration,
 * history and cycle position, so training one and skipping another is normal.
 */
export interface ExerciseState {
  /** Whether this track is visible and counted. Disabled tracks stay dormant. */
  enabled: boolean;
  settings: ExerciseSettings;
  maxTests: MaxTestEntry[];
  sessions: SessionEntry[];
  // Position in this exercise's microcycle for the *next* session to attempt
  // (1-based, never resets to 0). Advances only when a session is completed, so
  // a skipped day repeats the same prescription (methodology §Step 5).
  dayNumber: number;
  needsMaxTest: boolean;
}

export interface AppData {
  version: typeof SCHEMA_VERSION;
  onboardingComplete: boolean;
  health: HealthAnswers;
  settings: Settings;
  /** Always fully populated for every registered id — consumers never guard. */
  exercises: Record<ExerciseId, ExerciseState>;
}
