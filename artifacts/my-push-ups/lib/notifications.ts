import { Platform } from "react-native";

import type { ExerciseDef } from "./exercises/types";
import type { Settings } from "./types";

/**
 * Reminder copy for the enabled tracks. With a single track it is that
 * exercise's own wording; with several, a neutral line that doesn't privilege
 * one over the others.
 */
function reminderContent(exercises: ExerciseDef[]): {
  title: string;
  body: string;
} {
  if (exercises.length === 1) return exercises[0]!.copy.reminder;
  return {
    title: "Time to train",
    body: "Your daily session is ready.",
  };
}

// Without a handler, reminders that fire while the app is foregrounded are
// silently dropped on iOS. Called once at startup from the root layout.
export async function initNotificationHandler(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Notifications unavailable — fail silently.
  }
}

export async function rescheduleReminders(
  settings: Settings,
  exercises: ExerciseDef[] = [],
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.habitReminder.enabled) {
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const weekly = Notifications.SchedulableTriggerInputTypes.WEEKLY;
    const content = reminderContent(exercises);

    for (const weekday of settings.habitReminder.days) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: weekly,
          weekday: weekday + 1,
          hour: settings.habitReminder.hour,
          minute: settings.habitReminder.minute,
        },
      });
    }
  } catch {
    // Notifications unavailable (e.g. Expo Go on Android) — fail silently.
  }
}
