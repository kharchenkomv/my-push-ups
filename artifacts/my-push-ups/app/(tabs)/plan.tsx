import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Callout,
  Card,
  Kicker,
  ScreenTitle,
  SectionTitle,
  font,
} from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  DAY_LABELS,
  LEVEL_INFO,
  RETEST_DAYS,
  SESSION_ROUNDS,
  SESSION_TYPE_LABEL,
  addDays,
  dateKey,
  daysSinceMaxTest,
  formatSeconds,
  isHabitDay,
  planForDate,
  planForWeekday,
  sessionOn,
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
  const daysSince = daysSinceMaxTest(data);
  const retestIn =
    daysSince === null ? 0 : Math.max(0, RETEST_DAYS - daysSince);

  const todayPlan = planForDate(data, today);
  const progressionMessage =
    "Train 6+ days next week with all rounds done and effort 7 or lower, and each round's target goes up by 1. Hard weeks (effort 8+) ease it back.";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <ScreenTitle subtitle="Your programme">Plan</ScreenTitle>

      <Card>
        <Kicker color={colors.primary}>Current level</Kicker>
        <Text style={[styles.levelName, { color: colors.foreground }]}>
          {LEVEL_INFO[data.level]?.name}
        </Text>
        <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>
          {LEVEL_INFO[data.level]?.description}
        </Text>
      </Card>

      <SectionTitle>This week</SectionTitle>
      <Card style={styles.listCard}>
        {Array.from({ length: 7 }, (_, i) => {
          const key = addDays(weekStart, i);
          const wd = (i + 1) % 7;
          const t = isHabitDay(data.settings, wd);
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
                i < 6
                  ? {
                      borderBottomColor: colors.border,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isToday ? colors.primary : colors.mutedForeground,
                    fontFamily: isToday ? font.bodySemi : font.bodyMedium,
                  },
                ]}
              >
                {DAY_LABELS[wd]}
              </Text>
              <View style={styles.dayInfo}>
                <Text
                  style={[
                    styles.dayType,
                    { color: t ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {t
                    ? `${SESSION_TYPE_LABEL[planForWeekday(data.dailyTarget, wd).type]} · ${planForWeekday(data.dailyTarget, wd).total} reps`
                    : "Rest"}
                </Text>
              </View>
              {status === "done" ? (
                <Feather name="check" size={16} color={colors.success} />
              ) : status === "due" ? (
                <View style={[styles.dueDot, { backgroundColor: colors.primary }]} />
              ) : status === "missed" && t ? (
                <Feather name="minus" size={14} color={colors.mutedForeground} />
              ) : (
                <View style={{ width: 16 }} />
              )}
            </View>
          );
        })}
      </Card>

      <SectionTitle>Today's prescription</SectionTitle>
      <Card style={styles.listCard}>
        <PrescriptionRow
          label="Session"
          value={`${SESSION_TYPE_LABEL[todayPlan.type]} · ${todayPlan.total} reps`}
        />
        <PrescriptionRow
          label={`${SESSION_ROUNDS} rounds`}
          value={todayPlan.rounds.join(" · ")}
        />
        <PrescriptionRow
          label="Rest between rounds"
          value={formatSeconds(data.settings.restSeconds)}
        />
        <PrescriptionRow
          label="Goal"
          value={`${data.settings.goalReps} continuous reps`}
          last
        />
      </Card>

      <SectionTitle>How you progress</SectionTitle>
      <View style={styles.noteStack}>
        <Callout icon="trending-up" tone={colors.primary}>
          {progressionMessage}
        </Callout>
        <Callout
          icon="refresh-cw"
          tone={retestIn === 0 ? colors.warning : colors.mutedForeground}
        >
          {retestIn === 0
            ? "Re-test due — take a max test to recalibrate your plan."
            : `Next max re-test in about ${retestIn} ${retestIn === 1 ? "day" : "days"}.`}
        </Callout>
        <Callout icon="shield" tone={colors.success}>
          Sets stay submaximal — stop each round when your form breaks, never
          train to absolute failure.
        </Callout>
      </View>
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
          ? {
              borderBottomColor: colors.border,
              borderBottomWidth: StyleSheet.hairlineWidth,
            }
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

  levelName: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: font.display,
    marginTop: 8,
  },
  levelDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    marginTop: 6,
  },

  listCard: { paddingVertical: 4 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  dayLabel: {
    width: 44,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  dayInfo: { flex: 1 },
  dayType: { fontSize: 15, fontFamily: font.body },
  dueDot: { width: 7, height: 7, borderRadius: 4 },

  presRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  presLabel: { fontSize: 14, fontFamily: font.body },
  presValue: {
    fontSize: 15,
    fontFamily: font.bodySemi,
    flexShrink: 1,
    textAlign: "right",
  },

  noteStack: { gap: 10 },
});
