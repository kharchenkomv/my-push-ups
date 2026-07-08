import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, SectionTitle } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  DAY_LABELS,
  LEVEL_INFO,
  RETEST_DAYS,
  addDays,
  dateKey,
  daysSinceMaxTest,
  formatSeconds,
  sessionOn,
  trackForWeekday,
  weekStartKey,
} from "@/lib/training";

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useApp();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const today = dateKey();
  const weekStart = weekStartKey();
  const inDeload = data.deloadRemaining > 0;
  const daysSince = daysSinceMaxTest(data);
  const retestIn =
    daysSince === null ? 0 : Math.max(0, RETEST_DAYS - daysSince);

  const progressionMessage = inDeload
    ? `Deload week: ${data.deloadRemaining} lighter ${data.deloadRemaining === 1 ? "session" : "sessions"} left (3 rounds instead of 5).`
    : data.strengthSuccessStreak === 1
      ? "1 strong session down — one more at effort 7 or less and your reps go up."
      : "Complete 2 strong sessions in a row (effort ≤ 7) to add 1 rep per round.";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Plan</Text>

      <Card>
        <Text style={[styles.levelKicker, { color: colors.primary }]}>
          CURRENT LEVEL
        </Text>
        <Text style={[styles.levelName, { color: colors.foreground }]}>
          {LEVEL_INFO[data.level]?.name}
        </Text>
        <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>
          {LEVEL_INFO[data.level]?.description}
        </Text>
      </Card>

      <SectionTitle>This week's schedule</SectionTitle>
      <Card style={styles.scheduleCard}>
        {Array.from({ length: 7 }, (_, i) => {
          const key = addDays(weekStart, i);
          const wd = (i + 1) % 7;
          const t = trackForWeekday(data.settings, wd);
          const session = sessionOn(data.sessions, key);
          const isToday = key === today;
          const isPast = key < today;
          const status = session
            ? "done"
            : isToday
              ? "due"
              : isPast
                ? "missed"
                : "upcoming";
          return (
            <View
              key={key}
              style={[
                styles.dayRow,
                i < 6 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isToday ? colors.primary : colors.mutedForeground,
                  },
                ]}
              >
                {DAY_LABELS[wd]}
              </Text>
              <View style={styles.dayInfo}>
                <Text style={[styles.dayType, { color: colors.foreground }]}>
                  {t === "strength"
                    ? `Strength · ${inDeload ? 3 : 5} × ${data.roundRepsStrength}`
                    : t === "habit"
                      ? `Habit · 1 × ${data.roundRepsHabit}`
                      : "Rest"}
                </Text>
              </View>
              {status === "done" ? (
                <Feather name="check-circle" size={18} color={colors.success} />
              ) : status === "due" ? (
                <View
                  style={[styles.dueDot, { backgroundColor: colors.primary }]}
                />
              ) : status === "missed" && t ? (
                <Feather name="minus" size={16} color={colors.mutedForeground} />
              ) : (
                <View style={{ width: 18 }} />
              )}
            </View>
          );
        })}
      </Card>

      <SectionTitle>Current prescription</SectionTitle>
      <Card>
        <PrescriptionRow
          label="Strength session"
          value={`${inDeload ? 3 : 5} rounds of ${data.roundRepsStrength}`}
        />
        <PrescriptionRow
          label="Rest between rounds"
          value={formatSeconds(data.settings.restSeconds)}
        />
        <PrescriptionRow
          label="Daily habit set"
          value={`1 round of ${data.roundRepsHabit}`}
        />
        <PrescriptionRow
          label="Goal"
          value={`${data.settings.goalReps} continuous reps`}
          last
        />
      </Card>

      <SectionTitle>How you progress</SectionTitle>
      <Card>
        <View style={styles.msgRow}>
          <Feather name="trending-up" size={18} color={colors.primary} />
          <Text style={[styles.msgText, { color: colors.foreground }]}>
            {progressionMessage}
          </Text>
        </View>
      </Card>
      <Card style={styles.msgCard}>
        <View style={styles.msgRow}>
          <Feather
            name="refresh-cw"
            size={18}
            color={retestIn === 0 ? colors.warning : colors.mutedForeground}
          />
          <Text style={[styles.msgText, { color: colors.foreground }]}>
            {retestIn === 0
              ? "Re-test due — take a max test to recalibrate your plan."
              : `Next max re-test in about ${retestIn} ${retestIn === 1 ? "day" : "days"}.`}
          </Text>
        </View>
      </Card>
      <Card style={styles.msgCard}>
        <View style={styles.msgRow}>
          <Feather name="shield" size={18} color={colors.success} />
          <Text style={[styles.msgText, { color: colors.foreground }]}>
            Sessions stay submaximal — never train to failure. If effort hits 9+
            we scale back automatically.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

function PrescriptionRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.presRow,
        !last
          ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
          : null,
      ]}
    >
      <Text style={[styles.presLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.presValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  title: {
    fontSize: 32,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 16,
  },
  levelKicker: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  levelName: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold" },
  levelDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  scheduleCard: { paddingVertical: 4 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  dayLabel: {
    width: 44,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  dayInfo: { flex: 1 },
  dayType: { fontSize: 15, fontFamily: "Inter_500Medium" },
  dueDot: { width: 10, height: 10, borderRadius: 5 },
  presRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  presLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  presValue: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  msgCard: { marginTop: 12 },
  msgRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  msgText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
