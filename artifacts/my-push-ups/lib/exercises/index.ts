import type { ExerciseId } from "@/lib/types";

import type { ExerciseDef } from "./types";
import { pushups } from "./pushups";

// ============================================================================
// The exercise registry.
//
// Adding an exercise: widen `ExerciseId` in lib/types.ts, write the descriptor,
// add it here. Every screen, selector and migration iterates this map, so
// nothing else needs to learn the new id.
// ============================================================================

export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  pushups,
};

/** The exercise a fresh install starts with, and the fallback for a bad param. */
export const DEFAULT_EXERCISE_ID: ExerciseId = "pushups";

export const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];

export function isExerciseId(v: unknown): v is ExerciseId {
  return typeof v === "string" && v in EXERCISES;
}

/** Resolve an id, falling back to the default for anything unrecognised. */
export function getExercise(id?: string | null): ExerciseDef {
  return isExerciseId(id) ? EXERCISES[id] : EXERCISES[DEFAULT_EXERCISE_ID];
}

export type { ExerciseDef } from "./types";
export type {
  DayMeta,
  DayPlan,
  ExerciseCopy,
  ExerciseEngine,
  ExerciseFormat,
  IconName,
  RoundMode,
  Tone,
  Unit,
} from "./types";
