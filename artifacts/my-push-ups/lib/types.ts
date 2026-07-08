export type Level = 0 | 1 | 2 | 3;
export type Track = "habit" | "strength";
export type PainFlag = "wrist" | "shoulder" | "chest";

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

export interface Settings {
  restSeconds: number;
  habitDaysPerWeek: number;
  strengthDays: number[];
  goalReps: number;
  sound: boolean;
  haptics: boolean;
  habitReminder: ReminderConfig;
  strengthReminder: ReminderConfig;
}

export interface MaxTestEntry {
  date: string;
  level: Level;
  reps: number;
}

export interface SessionEntry {
  id: string;
  date: string;
  track: Track;
  level: Level;
  targetReps: number;
  roundsPlanned: number;
  roundsCompleted: number;
  repsPerRound: number[];
  rpe: number | null;
  painFlags: PainFlag[];
}

export interface AppData {
  onboardingComplete: boolean;
  level: Level;
  health: HealthAnswers;
  settings: Settings;
  maxTests: MaxTestEntry[];
  sessions: SessionEntry[];
  roundRepsHabit: number;
  roundRepsStrength: number;
  strengthSuccessStreak: number;
  deloadRemaining: number;
  lastHabitWeekEvaluated: string;
  needsMaxTest: boolean;
}
