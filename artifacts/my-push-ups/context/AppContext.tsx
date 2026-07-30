import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { dateKey, newId } from "@/lib/core";
import { EXERCISES } from "@/lib/exercises";
import { createInitialData, sanitizeImport } from "@/lib/state";
import type {
  AppData,
  ExerciseId,
  ExerciseSettings,
  ExerciseState,
  HealthAnswers,
  SessionEntry,
  Settings,
} from "@/lib/types";

const STORAGE_KEY = "mpu:data:v2";
// Older keys, newest first. Read-only: a legacy blob is migrated forward and
// then left in place, so reinstalling an older build still finds its own data
// instead of landing in onboarding and overwriting everything.
const LEGACY_KEYS = ["mpu:data:v1"];

interface AppContextValue {
  data: AppData | null;
  loading: boolean;
  completeOnboarding: (params: {
    maxValue: number;
    health: HealthAnswers;
  }) => Promise<void>;
  recordMaxTest: (id: ExerciseId, value: number) => Promise<void>;
  completeSession: (
    id: ExerciseId,
    entry: Omit<SessionEntry, "id">,
  ) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<Settings | null>;
  updateExerciseSettings: (
    id: ExerciseId,
    patch: Partial<ExerciseSettings>,
  ) => Promise<ExerciseSettings | null>;
  setExerciseEnabled: (id: ExerciseId, enabled: boolean) => Promise<void>;
  resetAll: () => Promise<void>;
  importData: (json: string) => Promise<boolean>;
  exportJson: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [wakeTick, setWakeTick] = useState<number>(0);
  const dataRef = useRef<AppData | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  dataRef.current = data;

  const enqueueWrite = useCallback((next: AppData) => {
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)))
      .catch(() => undefined);
    return writeQueue.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          // Sanitize on load: seeds newly-registered exercises and migrates any
          // shape written by an older app version.
          const parsed = sanitizeImport(JSON.parse(raw));
          if (parsed) {
            setData(parsed);
            // Persist only if migration actually changed the on-disk shape.
            if (JSON.stringify(parsed) !== raw) enqueueWrite(parsed);
            return;
          }
        }

        // No usable v2 blob — look for data written by an earlier schema.
        for (const key of LEGACY_KEYS) {
          const legacy = await AsyncStorage.getItem(key);
          if (cancelled) return;
          if (!legacy) continue;
          const parsed = sanitizeImport(JSON.parse(legacy));
          if (!parsed) continue;
          setData(parsed);
          // Write forward, but deliberately leave the legacy key intact.
          await enqueueWrite(parsed);
          return;
        }
      } catch {
        // Corrupt data — start fresh rather than crash.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enqueueWrite]);

  // Bump a tick on foreground so screens re-render and pick up date-derived
  // state (e.g. whether a max re-test has come due).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setWakeTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Atomic mutation: derive next state from the latest state, then persist.
  const mutate = useCallback(
    (updater: (prev: AppData) => AppData): Promise<void> => {
      return new Promise((resolve) => {
        setData((prev) => {
          if (!prev) {
            resolve();
            return prev;
          }
          const next = updater(prev);
          dataRef.current = next;
          enqueueWrite(next).finally(resolve);
          return next;
        });
      });
    },
    [enqueueWrite],
  );

  /** Scoped mutation of one track, reusing the atomic write path. */
  const mutateExercise = useCallback(
    (id: ExerciseId, updater: (prev: ExerciseState) => ExerciseState) =>
      mutate((prev) => ({
        ...prev,
        exercises: { ...prev.exercises, [id]: updater(prev.exercises[id]) },
      })),
    [mutate],
  );

  const completeOnboarding = useCallback(
    async (params: { maxValue: number; health: HealthAnswers }) => {
      const next = createInitialData(params);
      setData(next);
      await enqueueWrite(next);
    },
    [enqueueWrite],
  );

  const recordMaxTest = useCallback(
    async (id: ExerciseId, value: number) => {
      await mutateExercise(id, (prev) => ({
        ...prev,
        maxTests: [...prev.maxTests, { date: dateKey(), value }],
        // Round targets read the latest max directly, so nothing else to
        // recompute here (methodology §Step 6).
        needsMaxTest: false,
      }));
    },
    [mutateExercise],
  );

  const completeSession = useCallback(
    async (id: ExerciseId, entry: Omit<SessionEntry, "id">) => {
      await mutateExercise(id, (prev) => ({
        ...prev,
        sessions: [...prev.sessions, { ...entry, id: newId() }],
        // Advance the cycle only on completion; a skipped day leaves dayNumber
        // untouched so the same prescription repeats (§Step 5).
        dayNumber: EXERCISES[id].engine.advanceDayNumber(prev.dayNumber),
      }));
    },
    [mutateExercise],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await mutate((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
      return dataRef.current?.settings ?? null;
    },
    [mutate],
  );

  const updateExerciseSettings = useCallback(
    async (id: ExerciseId, patch: Partial<ExerciseSettings>) => {
      await mutateExercise(id, (prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
      return dataRef.current?.exercises[id].settings ?? null;
    },
    [mutateExercise],
  );

  const setExerciseEnabled = useCallback(
    async (id: ExerciseId, enabled: boolean) => {
      await mutateExercise(id, (prev) => ({ ...prev, enabled }));
    },
    [mutateExercise],
  );

  const resetAll = useCallback(async () => {
    setData(null);
    dataRef.current = null;
    // Delete *through the write queue*, not alongside it: a save still in
    // flight would otherwise land after the removal and resurrect the data.
    // Clearing the legacy keys matters too — a reset the user asked for must
    // not be undone by an old blob resurfacing on the next launch.
    writeQueue.current = writeQueue.current
      .then(() =>
        Promise.all(
          [STORAGE_KEY, ...LEGACY_KEYS].map((k) => AsyncStorage.removeItem(k)),
        ).then(() => undefined),
      )
      .catch(() => undefined);
    await writeQueue.current;
  }, []);

  const importData = useCallback(
    async (json: string) => {
      try {
        const sanitized = sanitizeImport(JSON.parse(json));
        if (!sanitized) return false;
        setData(sanitized);
        await enqueueWrite(sanitized);
        return true;
      } catch {
        return false;
      }
    },
    [enqueueWrite],
  );

  const exportJson = useCallback(() => {
    return dataRef.current ? JSON.stringify(dataRef.current, null, 2) : "";
  }, []);

  const value = useMemo(
    () => ({
      data,
      loading,
      completeOnboarding,
      recordMaxTest,
      completeSession,
      updateSettings,
      updateExerciseSettings,
      setExerciseEnabled,
      resetAll,
      importData,
      exportJson,
    }),
    // wakeTick is intentionally a dep: it changes the value identity on
    // foreground so consumers re-render and pick up date-derived state.
    [
      data,
      loading,
      wakeTick,
      completeOnboarding,
      recordMaxTest,
      completeSession,
      updateSettings,
      updateExerciseSettings,
      setExerciseEnabled,
      resetAll,
      importData,
      exportJson,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
