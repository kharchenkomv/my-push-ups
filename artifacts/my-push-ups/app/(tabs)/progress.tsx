import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  Kicker,
  ScreenTitle,
  SectionTitle,
  StatCard,
  font,
} from "@/components/UI";
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
  const daysDone = Array.from({ length: 28 }, (_, i) =>
    sessionDays.has(addDays(start, i)),
  );
  const doneCount = daysDone.filter(Boolean).length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <ScreenTitle subtitle="Consistency is the artwork">Progress</ScreenTitle>

      <View style={styles.statRow}>
        <StatCard label="Day streak" value={streak} accent={colors.primary} />
        <StatCard label="Sessions" value={totalSessions} />
        <StatCard label="Best max" value={bestCurrent} />
      </View>
      <View style={[styles.statRow, styles.statRowGap]}>
        <StatCard label="Total reps" value={totalReps} />
        <StatCard label="Level" value={LEVEL_INFO[data.level]?.short ?? "—"} />
      </View>

      <SectionTitle>Push-ups over time</SectionTitle>
      <Card>
        {repsSeries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Finish your first session to start the graph.
          </Text>
        ) : (
          <>
            <Kicker>
              {totalReps} reps · {totalSessions}{" "}
              {totalSessions === 1 ? "session" : "sessions"}
            </Kicker>
            <View style={styles.chartWrap}>
              <RepsChart points={repsSeries} />
            </View>
          </>
        )}
      </Card>

      <SectionTitle>Last four weeks</SectionTitle>
      <Card>
        {/* Rows of quiet dots — days marked and days missed. */}
        <View style={styles.dotGrid}>
          {daysDone.map((done, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: done ? colors.primary : "transparent",
                  borderColor: done ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.dotLegend, { color: colors.mutedForeground }]}>
          {doneCount} of 28 days trained
        </Text>
      </Card>

      <SectionTitle>Milestones</SectionTitle>
      <Card style={styles.listCard}>
        {MILESTONES.map((m, i) => {
          const achieved = milestoneBase >= m;
          return (
            <View
              key={m}
              style={[
                styles.milestoneRow,
                i < MILESTONES.length - 1
                  ? {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    }
                  : null,
              ]}
            >
              <View
                style={[
                  styles.milestoneMark,
                  {
                    backgroundColor: achieved ? colors.success : "transparent",
                    borderColor: achieved ? colors.success : colors.border,
                  },
                ]}
              >
                {achieved ? (
                  <Feather name="check" size={11} color="#ffffff" />
                ) : null}
              </View>
              <Text
                style={[
                  styles.milestoneText,
                  {
                    color: achieved
                      ? colors.foreground
                      : colors.mutedForeground,
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
        <Card style={styles.listCard}>
          {recentTests.map((t, i) => (
            <View
              key={`${t.date}-${i}`}
              style={[
                styles.testRow,
                i < recentTests.length - 1
                  ? {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    }
                  : null,
              ]}
            >
              <View style={styles.testInfo}>
                <Text style={[styles.testReps, { color: colors.foreground }]}>
                  {t.reps}
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

  statRow: { flexDirection: "row", gap: 10 },
  statRowGap: { marginTop: 10 },

  chartWrap: { marginTop: 12 },

  dotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    // Exactly 7 dots per row (7 * 22 + 6 * 10), so the 28 days read as four
    // calendar weeks rather than wrapping into an orphaned last row.
    width: 214,
    alignSelf: "center",
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  dotLegend: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 16,
  },

  listCard: { paddingVertical: 4 },

  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  milestoneMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneText: { fontSize: 15, fontFamily: font.body },

  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    textAlign: "center",
  },

  testRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
  },
  testInfo: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  testReps: { fontSize: 22, fontFamily: font.display },
  testLevel: { fontSize: 13, fontFamily: font.body },
  testDate: { fontSize: 13, fontFamily: font.body },
});
