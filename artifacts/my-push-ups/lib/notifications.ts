import { Platform } from "react-native";

import type { Settings } from "./types";

export async function rescheduleReminders(settings: Settings): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.habitReminder.enabled && !settings.strengthReminder.enabled) {
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const weekly = Notifications.SchedulableTriggerInputTypes.WEEKLY;

    if (settings.habitReminder.enabled) {
      for (const weekday of settings.habitReminder.days) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Morning push-ups",
            body: "Your quick habit set is ready. It only takes a minute.",
          },
          trigger: {
            type: weekly,
            weekday: weekday + 1,
            hour: settings.habitReminder.hour,
            minute: settings.habitReminder.minute,
          },
        });
      }
    }
    if (settings.strengthReminder.enabled) {
      for (const weekday of settings.strengthReminder.days) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Strength session",
            body: "5 rounds today. You've got this.",
          },
          trigger: {
            type: weekly,
            weekday: weekday + 1,
            hour: settings.strengthReminder.hour,
            minute: settings.strengthReminder.minute,
          },
        });
      }
    }
  } catch {
    // Notifications unavailable (e.g. Expo Go on Android) — fail silently.
  }
}
