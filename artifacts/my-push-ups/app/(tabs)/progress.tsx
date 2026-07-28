import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseProgressSection } from "@/components/exercise/ExerciseProgressSection";
import { Card, ScreenTitle, SectionTitle, StatCard, font } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useEnabledExercises, useTrainingDays } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { addDays, dateKey } from "@/lib/core";

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useApp();
  const views = useEnabledExercises();
  const { dates, streak } = useTrainingDays();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const showsName = views.length > 1;
  const solo = views.length === 1 ? views[0] : null;

  const totalSessions = views.reduce((a, v) => a + v.state.sessions.length, 0);

  // Four calendar weeks ending today. A day counts if *any* enabled track was
  // trained on it, which is the same thing as one track's own history at N=1.
  const trained = new Set(dates);
  const today = dateKey();
  const daysDone = Array.from({ length: 28 }, (_, i) =>
    trained.has(addDays(today, -(27 - i))),
  );
  const doneCount = daysDone.filter(Boolean).length;

  const weeksGrid = (
    <>
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
    </>
  );

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
        {solo ? <StatCard label="Best max" value={solo.bestMax} /> : null}
      </View>
      {solo ? (
        <View style={[styles.statRow, styles.statRowGap]}>
          <StatCard
            label={`Total ${solo.def.format.unitLabel}`}
            value={solo.state.sessions.reduce(
              (a, s) => a + s.valuePerRound.reduce((x, y) => x + y, 0),
              0,
            )}
          />
          <StatCard label="Current max" value={solo.currentMax} />
        </View>
      ) : null}

      {views.map((v) => (
        <ExerciseProgressSection
          key={v.id}
          view={v}
          showsName={showsName}
          interlude={solo ? weeksGrid : null}
        />
      ))}

      {/* With several tracks the grid is shared, so it follows them all. */}
      {solo ? null : weeksGrid}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },

  statRow: { flexDirection: "row", gap: 10 },
  statRowGap: { marginTop: 10 },

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
});
