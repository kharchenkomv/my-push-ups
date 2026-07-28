import { useMemo } from "react";

import { useApp } from "@/context/AppContext";
import { dateKey } from "@/lib/core";
import {
  enabledIds,
  overallStreak,
  selectExercise,
  trainedDates,
  type ExerciseSnapshot,
} from "@/lib/state";
import type { ExerciseId, ExerciseSettings, SessionEntry } from "@/lib/types";

// ============================================================================
// Scoped views over one training track.
//
// These are thin useMemo wrappers around the pure `selectExercise` builder, so
// every derived field stays node-testable and screens read `view.plan` rather
// than reaching into `data.exercises[id]` themselves.
// ============================================================================

export interface ExerciseView extends ExerciseSnapshot {
  recordMaxTest: (value: number) => Promise<void>;
  completeSession: (entry: Omit<SessionEntry, "id">) => Promise<void>;
  updateSettings: (
    patch: Partial<ExerciseSettings>,
  ) => Promise<ExerciseSettings | null>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export function useExercise(id: ExerciseId): ExerciseView | null {
  const {
    data,
    recordMaxTest,
    completeSession,
    updateExerciseSettings,
    setExerciseEnabled,
  } = useApp();

  return useMemo(() => {
    if (!data) return null;
    return {
      ...selectExercise(data, id),
      recordMaxTest: (value: number) => recordMaxTest(id, value),
      completeSession: (entry: Omit<SessionEntry, "id">) =>
        completeSession(id, entry),
      updateSettings: (patch: Partial<ExerciseSettings>) =>
        updateExerciseSettings(id, patch),
      setEnabled: (enabled: boolean) => setExerciseEnabled(id, enabled),
    };
  }, [
    data,
    id,
    recordMaxTest,
    completeSession,
    updateExerciseSettings,
    setExerciseEnabled,
  ]);
}

/**
 * Every enabled track, in registry order.
 *
 * Deliberately does NOT call `useExercise` in a loop — the enabled set changes
 * between renders, which would break the rules of hooks. It builds the same
 * views from the same pure selector instead.
 */
export function useEnabledExercises(): ExerciseView[] {
  const {
    data,
    recordMaxTest,
    completeSession,
    updateExerciseSettings,
    setExerciseEnabled,
  } = useApp();

  return useMemo(() => {
    if (!data) return [];
    const today = dateKey();
    return enabledIds(data).map((id) => ({
      ...selectExercise(data, id, today),
      recordMaxTest: (value: number) => recordMaxTest(id, value),
      completeSession: (entry: Omit<SessionEntry, "id">) =>
        completeSession(id, entry),
      updateSettings: (patch: Partial<ExerciseSettings>) =>
        updateExerciseSettings(id, patch),
      setEnabled: (enabled: boolean) => setExerciseEnabled(id, enabled),
    }));
  }, [
    data,
    recordMaxTest,
    completeSession,
    updateExerciseSettings,
    setExerciseEnabled,
  ]);
}

/** Days on which any enabled track was trained, and the streak over them. */
export function useTrainingDays(): { dates: string[]; streak: number } {
  const { data } = useApp();
  return useMemo(
    () =>
      data
        ? { dates: trainedDates(data), streak: overallStreak(data) }
        : { dates: [], streak: 0 },
    [data],
  );
}
