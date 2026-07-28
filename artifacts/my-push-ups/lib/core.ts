// ============================================================================
// Exercise-agnostic primitives: date maths, number clamping, formatting, ids.
//
// Nothing here knows what a push-up is. Keep it that way — every exercise's
// engine and the persistence layer both depend on this module, so a domain
// concept leaking in here would leak everywhere.
// ============================================================================

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// --- Date helpers -------------------------------------------------------------
//
// Dates are local-calendar day keys ("YYYY-MM-DD"), never timestamps: a session
// belongs to the day the user experienced, not to a UTC instant.

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function keyToDate(key: string): Date {
  const parts = key.split("-").map(Number);
  return new Date(parts[0] ?? 2026, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (keyToDate(b).getTime() - keyToDate(a).getTime()) / 86400000,
  );
}

export function weekdayOf(key: string): number {
  return keyToDate(key).getDay();
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${`${s}`.padStart(2, "0")}`;
}

// --- Stats --------------------------------------------------------------------

/**
 * Consecutive days ending today (or yesterday, if today isn't logged yet).
 * Takes anything date-stamped so it serves both a single exercise's sessions
 * and the union across several.
 */
export function currentStreak(
  entries: { date: string }[],
  today: string = dateKey(),
): number {
  const days = new Set(entries.map((e) => e.date));
  let streak = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function newId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}
