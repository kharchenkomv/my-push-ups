import type { ExerciseDef, DayPlan } from "@/lib/exercises/types";

import {
  DAY_TYPE_HINT,
  DAY_TYPE_ICON,
  DAY_TYPE_LABEL,
  DEFAULT_REST_SECONDS,
  MAX_REST_SECONDS,
  MICROCYCLE_DAYS,
  MILESTONES,
  RETEST_DAYS,
  SESSION_ROUNDS,
  advanceDayNumber,
  axisCeil,
  planForDay,
  type DayType,
} from "./engine";

// ============================================================================
// The push-up descriptor: the strength engine plus every string that names it.
//
// Copy here is transcribed verbatim from the screens it replaces — the refactor
// must not change a single rendered character.
// ============================================================================

export const pushups: ExerciseDef = {
  id: "pushups",

  engine: {
    cycleDays: MICROCYCLE_DAYS,
    roundsPerSession: SESSION_ROUNDS,
    // Matches the pre-refactor `currentMaxReps` fallback for an uncalibrated user.
    defaultMax: 5,
    retestDays: RETEST_DAYS,
    roundMode: "manual",
    planForDay,
    advanceDayNumber,
    dayMeta: (plan: DayPlan) => {
      const type = plan.type as DayType;
      return {
        label: DAY_TYPE_LABEL[type],
        hint: DAY_TYPE_HINT[type],
        icon: DAY_TYPE_ICON[type],
        tone: type === "technical" ? "rest" : "primary",
      };
    },
  },

  format: {
    unit: "reps",
    unitLabel: "reps",
    formatValue: (v) => `${v}`,
    formatValueLong: (v) => `${v} reps`,
    parseValue: (text) => {
      const n = parseInt(text, 10);
      return Number.isFinite(n) && n >= 1 && n <= 999 ? n : null;
    },
    maskInput: (t) => t.replace(/[^0-9]/g, "").slice(0, 3),
    inputMaxLength: 3,
    bounds: { min: 0, max: 99, step: 1 },
    axisCeil,
    gradientId: "trendFillPushups",
  },

  copy: {
    name: "Push-ups",
    nameLower: "push-ups",
    heroMax: (v) => `Max ${v} push-ups`,
    planMax: (v) => `${v} push-ups`,
    chartTitle: "Push-ups over time",
    maxTestTitle: "Take a max test",
    maxTestNavTitle: "Max-rep test",
    maxTestShort:
      "One set of push-ups to your technical limit — this sizes your whole plan.",
    maxTestIntro:
      "One set of push-ups to your technical limit. Stop the moment your form breaks — never push to absolute failure. This sizes your whole plan, so type only the clean reps.",
    maxTestRetestIntro:
      "One set of push-ups to your technical limit. Stop the moment your form breaks — never push to absolute failure. Type the number of clean reps you managed.",
    maxTestHistoryLabel: "max push-ups",
    milestoneLabel: (v) => `${v} continuous full push-ups`,
    progressNote:
      "Targets climb across the cycle — five build days, a hold day, then a light day — and reset each time it repeats. The light day is meant to be easy. Real progress comes from re-testing: as your max climbs, every round climbs with it.",
    submaximalNote:
      "Sets stay submaximal — stop each round when your form breaks, never train to absolute failure.",
    maxCardNote:
      "Every round is a submaximal share of this. Re-test to move it — and every target moves with it.",
    safetyNote:
      "If it hurts: try fists or push-up handles, raise the incline, or reduce reps today. Never train through pain.",
    painNote:
      "Try fists or push-up handles for wrists, or a higher incline. We'll go easier if this continues.",
    painBanner:
      "You flagged pain recently. Consider fists, handles, or a higher incline today.",
    restHint: "Longer rests keep each set strong. 1:30–2:00 suits strength work.",
    roundHint: "Tap the circle when you've completed all reps",
    reminder: {
      title: "Morning push-ups",
      body: "Your daily session is ready — 5 quick rounds, about 5 minutes.",
    },
    circleA11y: (round, value) => `Complete round ${round}, ${value} push-ups`,
  },

  milestones: MILESTONES,

  painOptions: [
    { key: "wrist", label: "Wrist" },
    { key: "shoulder", label: "Shoulder" },
    { key: "elbow", label: "Elbow" },
    { key: "chest", label: "Chest" },
  ],

  restOptions: [45, 60, 90, 120, 180],
  defaultRestSeconds: DEFAULT_REST_SECONDS,
  maxRestSeconds: MAX_REST_SECONDS,
};
