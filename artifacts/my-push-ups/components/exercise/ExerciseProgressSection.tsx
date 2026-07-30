import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Kicker, SectionTitle, StatCard, font } from "@/components/UI";
import { TrendChart } from "@/components/TrendChart";
import type { ExerciseView } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { keyToDate } from "@/lib/core";

/** One training track's block on the Progress screen. */
export function ExerciseProgressSection({
  view,
  showsName,
  interlude,
}: {
  view: ExerciseView;
  showsName: boolean;
  /**
   * Rendered between the chart and the milestones. With a single track the
   * screen slots the shared 28-day grid in here so the page order is exactly
   * what it was before the app could hold two exercises.
   */
  interlude?: React.ReactNode;
}) {
  const colors = useColors();
  const { def, state, currentMax, bestMax } = view;

  const sessions = state.sessions;
  const totalSessions = sessions.length;
  const totalValue = sessions.reduce(
    (a, s) => a + s.valuePerRound.reduce((x, y) => x + y, 0),
    0,
  );
  const series = sessions.map((s) => ({
    date: s.date,
    total: s.valuePerRound.reduce((x, y) => x + y, 0),
  }));
  const recentTests = state.maxTests.slice(-6).reverse();

  return (
    <View>
      {showsName ? <SectionTitle>{def.copy.name}</SectionTitle> : null}

      {showsName ? (
        <View style={styles.statRow}>
          <StatCard label="Sessions" value={totalSessions} />
          <StatCard label="Best max" value={bestMax} />
          <StatCard label="Current max" value={currentMax} />
        </View>
      ) : null}

      <SectionTitle>{def.copy.chartTitle}</SectionTitle>
      <Card>
        {series.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Finish your first session to start the graph.
          </Text>
        ) : (
          <>
            <Kicker>
              {totalValue} {def.format.unitLabel} · {totalSessions}{" "}
              {totalSessions === 1 ? "session" : "sessions"}
            </Kicker>
            <View style={styles.chartWrap}>
              <TrendChart
                points={series}
                gradientId={def.format.gradientId}
                axisCeil={def.format.axisCeil}
                formatValue={def.format.formatValue}
              />
            </View>
          </>
        )}
      </Card>

      {interlude}

      <SectionTitle>Milestones</SectionTitle>
      <Card style={styles.listCard}>
        {def.milestones.map((m, i) => {
          const achieved = bestMax >= m;
          return (
            <View
              key={m}
              style={[
                styles.milestoneRow,
                i < def.milestones.length - 1
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
                {def.copy.milestoneLabel(m)}
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
                  {def.format.formatValue(t.value)}
                </Text>
                <Text
                  style={[styles.testLevel, { color: colors.mutedForeground }]}
                >
                  {def.copy.maxTestHistoryLabel}
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
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: "row", gap: 10 },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    textAlign: "center",
  },
  chartWrap: { marginTop: 12 },

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
