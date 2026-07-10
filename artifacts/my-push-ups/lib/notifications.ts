import { Platform } from "react-native";

import type { Settings } from "./types";

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

export async function rescheduleReminders(settings: Settings): Promise<void> {
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
  } catch {
    // Notifications unavailable (e.g. Expo Go on Android) — fail silently.
  }
}
