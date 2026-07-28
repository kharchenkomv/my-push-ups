import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseTodayCard } from "@/components/exercise/ExerciseTodayCard";
import { Callout, Card, Kicker, StatCard, font } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useEnabledExercises, useTrainingDays } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { isHabitDay } from "@/lib/state";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useApp();
  const views = useEnabledExercises();
  const { streak } = useTrainingDays();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const now = new Date();
  const habitDay = isHabitDay(data.settings, now.getDay());
  // With a single track there is nothing to disambiguate, so no name headers
  // and the hero keeps carrying that exercise's own max.
  const showsName = views.length > 1;
  const solo = views.length === 1 ? views[0] : null;

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Kicker>{dateLabel}</Kicker>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            {greeting(now.getHours())}
          </Text>
          {solo ? (
            <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
              {solo.def.copy.heroMax(
                solo.def.format.formatValue(solo.currentMax),
              )}
            </Text>
          ) : null}
        </View>
        {streak > 0 ? (
          <View style={styles.streakWrap}>
            <Text style={[styles.streakValue, { color: colors.primary }]}>
              {streak}
            </Text>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
              day{streak === 1 ? "" : "s"}
            </Text>
          </View>
        ) : null}
      </View>

      {habitDay ? (
        <View style={styles.cardStack}>
          {views.map((v) => (
            <ExerciseTodayCard key={v.id} view={v} showsName={showsName} />
          ))}
        </View>
      ) : (
        <Card>
          <Kicker color={colors.rest}>Rest day</Kicker>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Recovery time
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Take it easy. See you tomorrow.
          </Text>
        </Card>
      )}

      <View style={styles.statRow}>
        <StatCard label="Day streak" value={streak} />
        {solo ? (
          <>
            <StatCard label="Best max" value={solo.bestMax} />
            <StatCard label="Since test" value={solo.daysSinceMaxTest ?? "—"} />
          </>
        ) : (
          <StatCard
            label="Sessions"
            value={views.reduce((a, v) => a + v.state.sessions.length, 0)}
          />
        )}
      </View>

      {solo ? (
        <Callout icon="alert-circle" style={styles.safety}>
          {solo.def.copy.safetyNote}
        </Callout>
      ) : (
        <Callout icon="alert-circle" style={styles.safety}>
          If it hurts: ease the movement, reduce the target, or rest today. Never
          train through pain.
        </Callout>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },

  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 28,
  },
  heroText: { flex: 1 },
  heroTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: font.display,
    marginTop: 6,
  },
  heroMeta: {
    fontSize: 14,
    fontFamily: font.body,
    marginTop: 2,
  },
  streakWrap: {
    alignItems: "center",
    paddingTop: 18,
  },
  streakValue: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: font.display,
  },
  streakLabel: {
    fontSize: 10,
    fontFamily: font.bodyMedium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  cardStack: { gap: 16 },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: font.display,
    marginTop: 8,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    marginTop: 6,
  },

  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  safety: { marginTop: 24 },
});
