import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, SectionTitle } from "@/components/UI";
import { RepsChart } from "@/components/RepsChart";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  LEVEL_INFO,
  MILESTONES,
  addDays,
  bestMax,
  currentStreak,
  dateKey,
  keyToDate,
} from "@/lib/training";
import type { Level } from "@/lib/types";

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useApp();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const streak = currentStreak(data.sessions);
  const totalSessions = data.sessions.length;
  const totalReps = data.sessions.reduce(
    (a, s) => a + s.repsPerRound.reduce((x, y) => x + y, 0),
    0,
  );
  const bestFull = bestMax(data, 3);
  const bestCurrent = bestMax(data, data.level);
  const milestoneBase = bestFull > 0 ? bestFull : 0;

  const today = dateKey();
  const start = addDays(today, -27);
  const sessionDays = new Set(data.sessions.map((s) => s.date));
  const repsSeries = data.sessions.map((s) => ({
    date: s.date,
    total: s.repsPerRound.reduce((x, y) => x + y, 0),
  }));

  const recentTests = [...data.maxTests].reverse().slice(0, 6);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Progress
      </Text>

      <View style={styles.statsRow}>
        <Card style={[styles.statCard, { borderColor: colors.border }]}>
          <View style={[styles.streakRing, { borderColor: colors.primary }]}>
            <Text style={[styles.streakValue, { color: colors.foreground }]}>
              {streak}
            </Text>
          </View>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            day streak
          </Text>
        </Card>
        <View style={styles.statCol}>
          <Card style={[styles.smallStat, { borderColor: colors.border }]}>
            <Text style={[styles.smallValue, { color: colors.foreground }]}>
              {totalSessions}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              sessions
            </Text>
          </Card>
          <Card style={[styles.smallStat, { borderColor: colors.border }]}>
            <Text style={[styles.smallValue, { color: colors.foreground }]}>
              {totalReps}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              total reps
            </Text>
          </Card>
        </View>
        <View style={styles.statCol}>
          <Card style={[styles.smallStat, { borderColor: colors.border }]}>
            <Text style={[styles.smallValue, { color: colors.foreground }]}>
              {bestCurrent}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              best max
            </Text>
          </Card>
          <Card style={[styles.smallStat, { borderColor: colors.border }]}>
            <Text style={[styles.smallValue, { color: colors.foreground }]}>
              {LEVEL_INFO[data.level]?.short}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              level
            </Text>
          </Card>
        </View>
      </View>

      <SectionTitle>Push-ups over time</SectionTitle>
      <Card>
        {repsSeries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Finish your first session to start the graph.
          </Text>
        ) : (
          <>
            <View style={styles.chartHead}>
              <Text style={[styles.chartTotal, { color: colors.foreground }]}>
                {totalReps}
              </Text>
              <Text
                style={[styles.chartTotalLabel, { color: colors.mutedForeground }]}
              >
                total push-ups · {totalSessions}{" "}
                {totalSessions === 1 ? "session" : "sessions"}
              </Text>
            </View>
            <RepsChart points={repsSeries} />
          </>
        )}
      </Card>

      <SectionTitle>Last 4 weeks</SectionTitle>
      <Card>
        <View style={styles.heatGrid}>
          {Array.from({ length: 28 }, (_, i) => {
            const key = addDays(start, i);
            const done = sessionDays.has(key);
            return (
              <View
                key={key}
                style={[
                  styles.heatCell,
                  {
                    backgroundColor: done ? colors.habit : colors.muted,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: colors.habit }]}
            />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
              Habit set done
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle>Milestones</SectionTitle>
      <Card style={styles.milestoneCard}>
        {MILESTONES.map((m, i) => {
          const achieved = milestoneBase >= m;
          return (
            <View
              key={m}
              style={[
                styles.milestoneRow,
                i < MILESTONES.length - 1
                  ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  : null,
              ]}
            >
              <View
                style={[
                  styles.milestoneBadge,
                  {
                    backgroundColor: achieved ? colors.success : colors.muted,
                  },
                ]}
              >
                {achieved ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : (
                  <Feather
                    name="lock"
                    size={12}
                    color={colors.mutedForeground}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.milestoneText,
                  {
                    color: achieved ? colors.foreground : colors.mutedForeground,
                  },
                ]}
              >
                {m} continuous full push-ups
              </Text>
            </View>
          );
        })}
      </Card>

      <SectionTitle>Max test history</SectionTitle>
      {recentTests.length === 0 ? (
        <Card>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Your training history starts with the first session.
          </Text>
        </Card>
      ) : (
        <Card style={styles.milestoneCard}>
          {recentTests.map((t, i) => (
            <View
              key={`${t.date}-${i}`}
              style={[
                styles.testRow,
                i < recentTests.length - 1
                  ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  : null,
              ]}
            >
              <View>
                <Text style={[styles.testReps, { color: colors.foreground }]}>
                  {t.reps} reps
                </Text>
                <Text
                  style={[styles.testLevel, { color: colors.mutedForeground }]}
                >
                  {LEVEL_INFO[t.level as Level]?.name}
                </Text>
              </View>
              <Text style={[styles.testDate, { color: colors.mutedForeground }]}>
                {keyToDate(t.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  title: {
    fontSize: 32,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 16,
  },
  chartHead: { marginBottom: 8 },
  chartTotal: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  chartTotalLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1.2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderWidth: 1,
  },
  statCol: { flex: 1, gap: 12 },
  smallStat: { alignItems: "center", paddingVertical: 12, borderWidth: 1 },
  streakRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  streakValue: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  smallValue: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  heatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  heatCell: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  legendRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 16,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  milestoneCard: { paddingVertical: 4 },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  milestoneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  testRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  testReps: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  testLevel: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  testDate: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
