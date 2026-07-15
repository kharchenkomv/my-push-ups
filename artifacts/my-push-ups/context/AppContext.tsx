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
            setData(parsed);
            // Persist the migration if the on-disk shape changed.
            if (JSON.stringify(parsed) !== raw) enqueueWrite(parsed);
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

  // Bump a tick when the app returns to foreground so date-derived screens
  // (today's rep target ramps with the calendar) recompute after midnight.
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
        return { ...prev, level, needsMaxTest: !test };
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
