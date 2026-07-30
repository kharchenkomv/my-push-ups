import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Callout, Card, Kicker, PrimaryButton, font } from "@/components/UI";
import type { ExerciseView } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { formatSeconds } from "@/lib/core";
import type { Tone } from "@/lib/exercises/types";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

/**
 * One training track's card on Today: calibration prompt, done state, or the
 * day's prescription.
 *
 * `showsName` is the single switch that keeps a one-exercise app looking
 * exactly as it did before it could hold two — with one track there is nothing
 * to disambiguate, so no name header is drawn.
 */
export function ExerciseTodayCard({
  view,
  showsName,
}: {
  view: ExerciseView;
  showsName: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const { def, state, plan, dayMeta, doneToday, testDue } = view;

  const toneColor: Record<Tone, string> = {
    primary: colors.primary,
    rest: colors.rest,
    warning: colors.warning,
    success: colors.success,
  };

  const startMaxTest = () =>
    router.push({
      pathname: "/workout",
      params: { track: "maxtest", exerciseId: def.id },
    });

  const nameHeader = showsName ? (
    <Kicker color={colors.primary}>{def.copy.name}</Kicker>
  ) : null;

  if (state.needsMaxTest) {
    return (
      <Card>
        {nameHeader}
        <Kicker color={colors.primary}>Calibration needed</Kicker>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {def.copy.maxTestTitle}
        </Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          {def.copy.maxTestShort}
        </Text>
        <View style={styles.cardAction}>
          <PrimaryButton
            label="Start max test"
            onPress={startMaxTest}
            testID="btn-start-maxtest-today"
          />
        </View>
      </Card>
    );
  }

  if (doneToday) {
    return (
      <Card>
        {nameHeader}
        <View style={styles.doneRow}>
          <View style={[styles.doneMark, { borderColor: colors.success }]}>
            <Feather name="check" size={18} color={colors.success} />
          </View>
          <View style={styles.doneText}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Done for today
            </Text>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
              {doneToday.valuePerRound.length}{" "}
              {doneToday.valuePerRound.length === 1 ? "round" : "rounds"} ·{" "}
              {doneToday.valuePerRound.reduce((a, b) => a + b, 0)}{" "}
              {def.format.unitLabel}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <View>
      <Card>
        {nameHeader}
        <View style={styles.cardHead}>
          <Kicker color={colors.primary}>
            {dayMeta.label} · Day {plan.microPos} of {def.engine.cycleDays}
          </Kicker>
          <Kicker>~5 min</Kicker>
        </View>
        <Text style={[styles.rounds, { color: colors.foreground }]}>
          {plan.rounds.map((r) => def.format.formatValue(r)).join(" · ")}
        </Text>
        <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
          {def.engine.roundsPerSession} rounds · {plan.total}{" "}
          {def.format.unitLabel} · rest{" "}
          {formatSeconds(state.settings.restSeconds)}
        </Text>
        {/* Says why today's numbers are what they are — a light day reading
            lower than yesterday is the plan working, not a mistake. */}
        <Callout
          icon={dayMeta.icon as FeatherName}
          tone={toneColor[dayMeta.tone]}
          style={styles.dayTip}
        >
          {dayMeta.hint}
        </Callout>
        <View style={styles.cardAction}>
          <PrimaryButton
            label="Start exercise"
            onPress={() =>
              router.push({
                pathname: "/workout",
                params: { track: "habit", exerciseId: def.id },
              })
            }
            testID="btn-start-training"
          />
        </View>
      </Card>

      {testDue ? (
        <Pressable onPress={startMaxTest} testID="btn-retest-due" style={styles.retest}>
          <Callout icon="refresh-cw" tone={colors.warning}>
            Re-test due — tap to recalibrate your plan.
          </Callout>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: font.display,
    marginTop: 8,
  },
  rounds: {
    fontSize: 28,
    lineHeight: 36,
    fontFamily: font.display,
    marginTop: 10,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    marginTop: 6,
  },
  dayTip: { marginTop: 16 },
  cardAction: { marginTop: 20 },

  doneRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  doneMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: { flex: 1 },

  retest: { marginTop: 16 },
});
