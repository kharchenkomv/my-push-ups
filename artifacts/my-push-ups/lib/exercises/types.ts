import type { ExerciseId, PainFlag } from "@/lib/types";

// ============================================================================
// The exercise descriptor — everything that varies between exercises.
//
// Adding an exercise means writing one of these and registering it. Nothing in
// here may import React or react-native: descriptors are plain data + pure
// functions so the whole registry is testable under node. Icons are therefore
// plain strings, validated at the call site that renders them.
// ============================================================================

export type Unit = "reps" | "seconds";

/**
 * How a round is performed. `manual` — the user works at their own pace and
 * taps when done (push-ups). `timed` — the app counts the hold down (plank).
 */
export type RoundMode = "manual" | "timed";

/** Semantic colour role, resolved against the palette by the rendering screen. */
export type Tone = "primary" | "rest" | "warning" | "success";

/** A Feather icon name. Kept as a string to keep this module React-free. */
export type IconName = string;

export interface DayPlan {
  dayNumber: number; // global cycle counter (1-based)
  microPos: number; // position within the cycle (1..cycleDays)
  type: string; // engine-private tag, e.g. "progressive" | "hold" | "technical"
  rounds: number[]; // per-round targets, in the exercise's unit
  total: number;
}

/** How a given day in the cycle is presented to the user. */
export interface DayMeta {
  label: string; // "Build" | "Hold" | "Light"
  hint: string; // the one-line explanation on Today
  icon: IconName;
  tone: Tone;
}

export interface ExerciseEngine {
  cycleDays: number;
  roundsPerSession: number;
  /** Assumed capacity before the first max test. */
  defaultMax: number;
  retestDays: number;
  roundMode: RoundMode;
  /** This exercise's own progression maths — not a shared, parameterised one. */
  planForDay(max: number, dayNumber: number): DayPlan;
  advanceDayNumber(dayNumber: number): number;
  dayMeta(plan: DayPlan): DayMeta;
}

export interface ExerciseFormat {
  unit: Unit;
  /** Lowercase noun for a quantity, e.g. "reps" / "hold". */
  unitLabel: string;
  /** Bare display value: "12" for reps, "1:30" for a hold. */
  formatValue(v: number): string;
  /** Value with its unit: "12 reps", "1:30 hold". */
  formatValueLong(v: number): string;
  /** Parse typed input back to a number, or null if unusable. */
  parseValue(text: string): number | null;
  /** Constrain raw keystrokes as the user types. */
  maskInput(text: string): string;
  inputMaxLength: number;
  bounds: { min: number; max: number; step: number };
  /** Chart y-axis ceiling — rep counts and seconds round differently. */
  axisCeil(v: number): number;
  /** Unique SVG gradient id; two charts on one screen must not collide. */
  gradientId: string;
}

/**
 * Every user-visible string that mentions the exercise. Single-sourcing these
 * is what stops "push-ups" reappearing in a screen once plank exists.
 */
export interface ExerciseCopy {
  name: string; // "Push-ups"
  nameLower: string; // "push-ups"
  heroMax(value: string): string; // "Max 20 push-ups"
  planMax(value: string): string; // "20 push-ups"
  chartTitle: string; // "Push-ups over time"
  maxTestTitle: string; // "Take a max test"
  maxTestNavTitle: string; // "Max-rep test"
  maxTestShort: string; // Today's calibration card body — one sentence
  maxTestIntro: string; // onboarding's full paragraph ("…sizes your whole plan")
  maxTestRetestIntro: string; // the re-test paragraph ("…type the number you managed")
  maxTestHistoryLabel: string; // "max push-ups"
  milestoneLabel(v: number): string; // "50 continuous full push-ups"
  progressNote: string; // Plan's "How you progress" callout
  submaximalNote: string; // Plan's "Sets stay submaximal…" callout
  maxCardNote: string; // Plan's current-max card body
  safetyNote: string; // Today's "If it hurts…" callout
  painNote: string; // the summary's pain advice
  painBanner: string; // workout's recent-pain banner
  restHint: string; // Settings' rest-duration explanation
  roundHint: string; // workout's "Tap the circle when…"
  reminder: { title: string; body: string };
  circleA11y(round: number, value: number): string;
}

export interface ExerciseDef {
  id: ExerciseId;
  engine: ExerciseEngine;
  format: ExerciseFormat;
  copy: ExerciseCopy;
  milestones: number[];
  painOptions: { key: PainFlag; label: string }[];
  restOptions: number[];
  defaultRestSeconds: number;
  maxRestSeconds: number;
}
