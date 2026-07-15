import { Feather, Ionicons } from "@expo/vector-icons";
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

import { Card, PrimaryButton, SectionTitle } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  LEVEL_INFO,
  SESSION_REST_SECONDS,
  SESSION_ROUNDS,
  bestMax,
  currentStreak,
  dateKey,
  daysSinceMaxTest,
  formatSeconds,
  isHabitDay,
  maxTestDue,
  sessionOn,
  sessionRoundReps,
} from "@/lib/training";

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useApp();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const today = dateKey();
  const weekday = new Date().getDay();
  const habitDay = isHabitDay(data.settings, weekday);
  const doneToday = sessionOn(data.sessions, today);
  const testDue = data.needsMaxTest || maxTestDue(data);
  const streak = currentStreak(data.sessions);
  const best = bestMax(data, data.level);
  const daysSince = daysSinceMaxTest(data);
  const todayReps = sessionRoundReps(data);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <View style={styles.homeHero}>
        <View>
          <Text style={[styles.homeGreeting, { color: colors.mutedForeground }]}>
            Good morning
          </Text>
          <Text style={[styles.homeTitle, { color: colors.foreground }]}>
            Level {data.level}
          </Text>
        </View>
        <View style={[styles.streakChip, { backgroundColor: colors.accent }]}>
          <Ionicons name="flame" size={14} color={colors.accentForeground} />
          <Text style={[styles.streakChipText, { color: colors.accentForeground }]}>
            {streak}
          </Text>
        </View>
      </View>

      {data.needsMaxTest ? (
        <Card style={[styles.trackCard, { borderLeftColor: colors.primary }]}>
          <View style={styles.trackCardHead}>
            <Text style={[styles.trackTag, { color: colors.primary }]}>CALIBRATION NEEDED</Text>
          </View>
          <Text style={[styles.trackCardTitle, { color: colors.foreground }]}>
            Take a max test
          </Text>
          <Text style={[styles.trackCardMeta, { color: colors.mutedForeground }]}>
            One set of {LEVEL_INFO[data.level]?.name.toLowerCase()} to size your new plan.
          </Text>
          <View style={styles.cardBtn}>
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
        <Card style={[styles.trackCard, { borderLeftColor: colors.success }]}>
          <View style={styles.doneRow}>
            <View
              style={[styles.doneBadge, { backgroundColor: "rgba(31,138,76,0.15)" }]}
            >
              <Feather name="check" size={24} color={colors.success} />
            </View>
            <View style={styles.doneTextWrap}>
              <Text style={[styles.trackCardTitle, { color: colors.foreground }]}>
                Done for today
              </Text>
              <Text style={[styles.trackCardMeta, { color: colors.mutedForeground }]}>
                {doneToday.repsPerRound.length}{" "}
                {doneToday.repsPerRound.length === 1 ? "round" : "rounds"} ·{" "}
                {doneToday.repsPerRound.reduce((a, b) => a + b, 0)} reps
              </Text>
            </View>
          </View>
        </Card>
      ) : habitDay ? (
        <Card style={[
          styles.trackCard,
          { borderLeftColor: colors.habit, backgroundColor: colors.habitSoft }
        ]}>
          <View style={styles.trackCardHead}>
            <Text style={[styles.trackTag, { color: colors.secondary }]}>
              Today's exercise
            </Text>
            <Text style={styles.trackCardTime}>~5 min</Text>
          </View>
          <Text style={[styles.trackCardTitle, { color: colors.foreground }]}>
            {SESSION_ROUNDS} rounds of {todayReps}
          </Text>
          <Text style={[styles.trackCardMeta, { color: colors.mutedForeground }]}>
            {LEVEL_INFO[data.level]?.name} · rest {formatSeconds(SESSION_REST_SECONDS)} between rounds
          </Text>
          <View style={styles.cardBtn}>
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
        <Card style={[styles.trackCard, { borderLeftColor: colors.rest }]}>
          <View style={styles.trackCardHead}>
            <Text style={[styles.trackTag, { color: colors.rest }]}>REST DAY</Text>
          </View>
          <Text style={[styles.trackCardTitle, { color: colors.foreground }]}>
            Recovery time
          </Text>
          <Text style={[styles.trackCardMeta, { color: colors.mutedForeground }]}>
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
          style={{ marginTop: 16 }}
        >
          <View style={[styles.infoCallout, { backgroundColor: colors.warning + "20" }]}>
            <View style={styles.retestRow}>
              <Feather name="refresh-cw" size={18} color={colors.warning} />
              <Text style={[styles.retestText, { color: colors.warning }]}>
                Re-test due — tap to recalibrate
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.miniStatRow}>
        <View style={[styles.miniStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.miniStatValue, { color: colors.primary }]}>{streak}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.mutedForeground }]}>Day streak</Text>
        </View>
        <View style={[styles.miniStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.miniStatValue, { color: colors.primary }]}>{best}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.mutedForeground }]}>Best max</Text>
        </View>
        <View style={[styles.miniStat, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.miniStatValue, { color: colors.primary }]}>{daysSince ?? "—"}</Text>
          <Text style={[styles.miniStatLabel, { color: colors.mutedForeground }]}>Days since test</Text>
        </View>
      </View>

      <View style={[styles.infoCallout, { backgroundColor: colors.muted, marginTop: 16 }]}>
        <Text style={[styles.infoCalloutText, { color: colors.mutedForeground }]}>
          <Text style={{ fontFamily: "Inter_700Bold" }}>If it hurts:</Text> try fists or push-up handles, raise the incline, or reduce reps/rounds today. Never train through pain.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  
  homeHero: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  homeGreeting: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  homeTitle: {
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
    marginTop: 4,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  streakChipText: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  
  trackCard: {
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  trackCardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  trackTag: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trackCardTime: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#A7A9BC",
  },
  trackCardTitle: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  trackCardMeta: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  cardBtn: { marginTop: 16 },
  
  doneRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  doneBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTextWrap: { flex: 1 },
  
  miniStatRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  miniStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  miniStatValue: {
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  miniStatLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },

  infoCallout: {
    padding: 16,
    borderRadius: 12,
  },
  infoCalloutText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  
  retestRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  retestText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
