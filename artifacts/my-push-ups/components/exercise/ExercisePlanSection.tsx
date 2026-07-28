import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Callout, Card, Kicker, SectionTitle, font } from "@/components/UI";
import type { ExerciseView } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { formatSeconds } from "@/lib/core";

/** One training track's block on the Plan screen. */
export function ExercisePlanSection({
  view,
  showsName,
}: {
  view: ExerciseView;
  showsName: boolean;
}) {
  const colors = useColors();
  const { def, state, plan, currentMax, daysSinceMaxTest } = view;

  const retestIn =
    daysSinceMaxTest === null
      ? 0
      : Math.max(0, def.engine.retestDays - daysSinceMaxTest);

  return (
    <View>
      {showsName ? <SectionTitle>{def.copy.name}</SectionTitle> : null}

      <Card>
        <Kicker color={colors.primary}>Current max</Kicker>
        <Text style={[styles.levelName, { color: colors.foreground }]}>
          {def.copy.planMax(def.format.formatValue(currentMax))}
        </Text>
        <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>
          {def.copy.maxCardNote}
        </Text>
      </Card>

      <SectionTitle>The {def.engine.cycleDays}-day cycle</SectionTitle>
      <Card style={styles.listCard}>
        {Array.from({ length: def.engine.cycleDays }, (_, i) => {
          const pos = i + 1;
          const dayPlan = def.engine.planForDay(currentMax, pos);
          const meta = def.engine.dayMeta(dayPlan);
          const isCurrent = pos === plan.microPos;
          const isPast = pos < plan.microPos;
          return (
            <View
              key={pos}
              style={[
                styles.dayRow,
                i < def.engine.cycleDays - 1
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
                  {meta.label} · {dayPlan.total} {def.format.unitLabel}
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

      <SectionTitle>Today&apos;s prescription</SectionTitle>
      <Card style={styles.listCard}>
        <PrescriptionRow
          label="Day"
          value={`${view.dayMeta.label} · day ${plan.microPos} of ${def.engine.cycleDays}`}
        />
        <PrescriptionRow
          label={`${def.engine.roundsPerSession} rounds`}
          value={plan.rounds.map((r) => def.format.formatValue(r)).join(" · ")}
        />
        <PrescriptionRow
          label="Rest between rounds"
          value={formatSeconds(state.settings.restSeconds)}
          last
        />
      </Card>

      <SectionTitle>How you progress</SectionTitle>
      <View style={styles.noteStack}>
        <Callout icon="trending-up" tone={colors.primary}>
          {def.copy.progressNote}
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
          {def.copy.submaximalNote}
        </Callout>
      </View>
    </View>
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
