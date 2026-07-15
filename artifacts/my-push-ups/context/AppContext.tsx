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

import {
  createInitialData,
  dailyTargetFor,
  evaluateWeek,
  latestMaxTest,
  dateKey,
  newId,
  sanitizeImport,
} from "@/lib/training";
import type {
  AppData,
  HealthAnswers,
  Level,
  SessionEntry,
  Settings,
} from "@/lib/types";

const STORAGE_KEY = "mpu:data:v1";

interface AppContextValue {
  data: AppData | null;
  loading: boolean;
  completeOnboarding: (params: {
    level: Level;
    maxReps: number;
    health: HealthAnswers;
    goalReps: number;
  }) => Promise<void>;
  recordMaxTest: (reps: number) => Promise<void>;
  completeSession: (entry: Omit<SessionEntry, "id">) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<Settings | null>;
  setLevel: (level: Level) => Promise<void>;
  setHealth: (health: HealthAnswers) => Promise<void>;
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
          // Sanitize on load: migrates data written by older app versions
          // (roundRepsHabit / weekly-eval fields, strength-track data, pre-`days`
          // reminder configs) to the current shape.
          const parsed = sanitizeImport(JSON.parse(raw));
          if (parsed) {
            // Run any pending weekly progression, then persist if the on-disk
            // shape changed (migration and/or the weekly adjustment).
            const weekly = evaluateWeek(parsed);
            const next = weekly ? { ...parsed, ...weekly } : parsed;
            setData(next);
            if (JSON.stringify(next) !== raw) enqueueWrite(next);
          }
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

  // Re-check the week boundary when the app returns to foreground so a
  // rollover applies the weekly progression and screens refresh.
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

  // Apply the weekly progression whenever the week rolls over while running.
  useEffect(() => {
    if (!data) return;
    if (evaluateWeek(data)) {
      mutate((prev) => {
        const w = evaluateWeek(prev);
        return w ? { ...prev, ...w } : prev;
      });
    }
  }, [data, wakeTick, mutate]);

  const completeOnboarding = useCallback(
    async (params: {
      level: Level;
      maxReps: number;
      health: HealthAnswers;
      goalReps: number;
    }) => {
      const next = createInitialData(params);
      setData(next);
      await enqueueWrite(next);
    },
    [enqueueWrite],
  );

  const recordMaxTest = useCallback(
    async (reps: number) => {
      await mutate((prev) => ({
        ...prev,
        maxTests: [
          ...prev.maxTests,
          { date: dateKey(), level: prev.level, reps },
        ],
        // Re-test recalculates the daily target from the fresh max (spec §2.2).
        dailyTarget: dailyTargetFor(reps, prev.level),
        needsMaxTest: false,
      }));
    },
    [mutate],
  );

  const completeSession = useCallback(
    async (entry: Omit<SessionEntry, "id">) => {
      await mutate((prev) => {
        const session: SessionEntry = { ...entry, id: newId() };
        return {
          ...prev,
          sessions: [...prev.sessions, session],
        };
      });
    },
    [mutate],
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

  const setLevel = useCallback(
    async (level: Level) => {
      await mutate((prev) => {
        const test = latestMaxTest({ ...prev, level }, level);
        return {
          ...prev,
          level,
          needsMaxTest: !test,
          ...(test
            ? { dailyTarget: dailyTargetFor(test.reps, level) }
            : {}),
        };
      });
    },
    [mutate],
  );

  const setHealth = useCallback(
    async (health: HealthAnswers) => {
      await mutate((prev) => ({ ...prev, health }));
    },
    [mutate],
  );

  const resetAll = useCallback(async () => {
    setData(null);
    dataRef.current = null;
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
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
      setLevel,
      setHealth,
      resetAll,
      importData,
      exportJson,
    }),
    // wakeTick is intentionally a dep: it changes the value identity on
    // foreground so consumers re-render and pick up the new day's rep target.
    [
      data,
      loading,
      wakeTick,
      completeOnboarding,
      recordMaxTest,
      completeSession,
      updateSettings,
      setLevel,
      setHealth,
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
