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
  DAY_TYPE_LABEL,
  MICROCYCLE_DAYS,
  RETEST_DAYS,
  SESSION_ROUNDS,
  currentMaxReps,
  daysSinceMaxTest,
  formatSeconds,
  microPosOf,
  planForDate,
  planForDay,
} from "@/lib/training";

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useApp();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const daysSince = daysSinceMaxTest(data);
  const retestIn =
    daysSince === null ? 0 : Math.max(0, RETEST_DAYS - daysSince);

  const max = currentMaxReps(data);
  const todayPlan = planForDate(data);
  const currentPos = microPosOf(data.dayNumber);

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
        <Kicker color={colors.primary}>Current max</Kicker>
        <Text style={[styles.levelName, { color: colors.foreground }]}>
          {max} push-ups
        </Text>
        <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>
          Every round is a submaximal share of this. Re-test to move it — and
          every target moves with it.
        </Text>
      </Card>

      <SectionTitle>The 7-day cycle</SectionTitle>
      <Card style={styles.listCard}>
        {Array.from({ length: MICROCYCLE_DAYS }, (_, i) => {
          const pos = i + 1;
          const dayPlan = planForDay(max, pos);
          const isCurrent = pos === currentPos;
          const isPast = pos < currentPos;
          return (
            <View
              key={pos}
              style={[
                styles.dayRow,
                i < MICROCYCLE_DAYS - 1
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
                    color: isCurrent ? colors.primary : colors.mutedForeground,
                    fontFamily: isCurrent ? font.bodySemi : font.bodyMedium,
                  },
                ]}
              >
                Day {pos}
              </Text>
              <View style={styles.dayInfo}>
                <Text
                  style={[
                    styles.dayType,
                    {
                      color: isCurrent
                        ? colors.foreground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {DAY_TYPE_LABEL[dayPlan.type]} · {dayPlan.total} reps
                </Text>
              </View>
              {isCurrent ? (
                <View style={[styles.dueDot, { backgroundColor: colors.primary }]} />
              ) : isPast ? (
                <Feather name="check" size={16} color={colors.success} />
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
          label="Day"
          value={`${DAY_TYPE_LABEL[todayPlan.type]} · day ${todayPlan.microPos} of ${MICROCYCLE_DAYS}`}
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
          Targets ease up across the cycle — five progressive days, a hold day,
          then a lighter technical day — and reset each time it repeats. Real
          progress comes from re-testing: as your max climbs, every round climbs
          with it.
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
