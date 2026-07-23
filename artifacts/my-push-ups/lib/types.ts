export type PainFlag = "wrist" | "shoulder" | "elbow" | "chest";

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
  habitDaysPerWeek: number;
  restSeconds: number;
  goalReps: number;
  sound: boolean;
  habitReminder: ReminderConfig;
}

export interface MaxTestEntry {
  date: string;
  reps: number;
}

export interface SessionEntry {
  id: string;
  date: string;
  targetReps: number;
  roundsPlanned: number;
  roundsCompleted: number;
  repsPerRound: number[];
  rpe: number | null;
  painFlags: PainFlag[];
}

export interface AppData {
  onboardingComplete: boolean;
  health: HealthAnswers;
  settings: Settings;
  maxTests: MaxTestEntry[];
  sessions: SessionEntry[];
  // Position in the 7-day strength microcycle for the *next* session to attempt
  // (1-based, never resets to 0). Advances only when a session is completed, so
  // a skipped day repeats the same prescription (methodology §Step 5).
  dayNumber: number;
  needsMaxTest: boolean;
}
