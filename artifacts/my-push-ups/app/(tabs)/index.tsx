import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Callout,
  Card,
  Kicker,
  PrimaryButton,
  StatCard,
  font,
} from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  LEVEL_INFO,
  SESSION_ROUNDS,
  SESSION_TYPE_LABEL,
  bestMax,
  currentStreak,
  dateKey,
  daysSinceMaxTest,
  formatSeconds,
  isHabitDay,
  maxTestDue,
  planForDate,
  sessionOn,
} from "@/lib/training";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useApp();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const now = new Date();
  const today = dateKey();
  const weekday = now.getDay();
  const habitDay = isHabitDay(data.settings, weekday);
  const doneToday = sessionOn(data.sessions, today);
  const testDue = data.needsMaxTest || maxTestDue(data);
  const streak = currentStreak(data.sessions);
  const best = bestMax(data, data.level);
  const daysSince = daysSinceMaxTest(data);
  const plan = planForDate(data, today);

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
          <Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>
            {LEVEL_INFO[data.level]?.name}
          </Text>
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

      {data.needsMaxTest ? (
        <Card>
          <Kicker color={colors.primary}>Calibration needed</Kicker>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Take a max test
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            One set of {LEVEL_INFO[data.level]?.name.toLowerCase()} to size your
            new plan.
          </Text>
          <View style={styles.cardAction}>
            <PrimaryButton
              label="Start max test"
              onPress={() =>
                router.push({ pathname: "/workout", params: { track: "maxtest" } })
              }
              testID="btn-start-maxtest-today"
            />
          </View>
        </Card>
      ) : doneToday ? (
        <Card>
          <View style={styles.doneRow}>
            <View style={[styles.doneMark, { borderColor: colors.success }]}>
              <Feather name="check" size={18} color={colors.success} />
            </View>
            <View style={styles.doneText}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Done for today
              </Text>
              <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
                {doneToday.repsPerRound.length}{" "}
                {doneToday.repsPerRound.length === 1 ? "round" : "rounds"} ·{" "}
                {doneToday.repsPerRound.reduce((a, b) => a + b, 0)} reps
              </Text>
            </View>
          </View>
        </Card>
      ) : habitDay ? (
        <Card>
          <View style={styles.cardHead}>
            <Kicker color={colors.primary}>
              {SESSION_TYPE_LABEL[plan.type]} session
            </Kicker>
            <Kicker>~5 min</Kicker>
          </View>
          <Text style={[styles.rounds, { color: colors.foreground }]}>
            {plan.rounds.join(" · ")}
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            {SESSION_ROUNDS} rounds · {plan.total} reps ·{" "}
            {LEVEL_INFO[data.level]?.name} · rest{" "}
            {formatSeconds(data.settings.restSeconds)}
          </Text>
          <View style={styles.cardAction}>
            <PrimaryButton
              label="Start exercise"
              onPress={() =>
                router.push({ pathname: "/workout", params: { track: "habit" } })
              }
              testID="btn-start-training"
            />
          </View>
        </Card>
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

      {!data.needsMaxTest && testDue ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/workout", params: { track: "maxtest" } })
          }
          testID="btn-retest-due"
          style={styles.retest}
        >
          <Callout icon="refresh-cw" tone={colors.warning}>
            Re-test due — tap to recalibrate your plan.
          </Callout>
        </Pressable>
      ) : null}

      <View style={styles.statRow}>
        <StatCard label="Day streak" value={streak} />
        <StatCard label="Best max" value={best} />
        <StatCard label="Since test" value={daysSince ?? "—"} />
      </View>

      <Callout icon="alert-circle" style={styles.safety}>
        If it hurts: try fists or push-up handles, raise the incline, or reduce
        reps today. Never train through pain.
      </Callout>
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

  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
  },

  safety: { marginTop: 24 },
});
