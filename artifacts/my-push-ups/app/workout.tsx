import { Feather } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BigCircle } from "@/components/BigCircle";
import { Callout, Card, Kicker, PrimaryButton, font } from "@/components/UI";
import { Stepper } from "@/app/onboarding";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  SESSION_ROUNDS,
  SESSION_TYPE_LABEL,
  LEVEL_INFO,
  dateKey,
  formatSeconds,
  planForDate,
  recentPainFlags,
} from "@/lib/training";
import type { PainFlag } from "@/lib/types";

type Phase = "work" | "rest" | "summary";

const MAX_REPS = 99;

const PAIN_OPTIONS: { key: PainFlag; label: string }[] = [
  { key: "wrist", label: "Wrist" },
  { key: "shoulder", label: "Shoulder" },
  { key: "elbow", label: "Elbow" },
  { key: "chest", label: "Chest" },
];

export default function WorkoutScreen() {
  // Keep the screen on during a workout. Native only: the web Wake Lock API
  // throws a permission error in embedded/insecure contexts.
  useEffect(() => {
    if (Platform.OS === "web") return;
    activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      deactivateKeepAwake().catch(() => undefined);
    };
  }, []);
  const { track } = useLocalSearchParams<{ track?: string }>();
  if (track === "maxtest") return <MaxTestFlow />;
  return <SessionFlow />;
}

const beepSource = require("@/assets/sounds/beep.wav");
const chimeSource = require("@/assets/sounds/chime.wav");

function useRestSounds() {
  const { data } = useApp();
  const enabled = (data?.settings.sound ?? true) && Platform.OS !== "web";
  const beepPlayer = useAudioPlayer(beepSource);
  const chimePlayer = useAudioPlayer(chimeSource);

  useEffect(() => {
    if (Platform.OS === "web") return;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const play = (player: ReturnType<typeof useAudioPlayer>) => {
    if (!enabled) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore playback errors
    }
  };

  return {
    beep: () => play(beepPlayer),
    chime: () => play(chimePlayer),
  };
}

function useHaptic() {
  const { data } = useApp();
  const enabled = data?.settings.haptics ?? true;
  return {
    light: () => {
      if (enabled && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined,
        );
      }
    },
    success: () => {
      if (enabled && Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      }
    },
  };
}

/** Shared top bar for the workout flows: close on the left, quiet title. */
function WorkoutBar({
  title,
  onClose,
  topPad,
  closeIcon = "x",
  testID,
}: {
  title: string;
  onClose: () => void;
  topPad: number;
  closeIcon?: "x" | "chevron-left";
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.navBar,
        { paddingTop: topPad, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        onPress={onClose}
        style={styles.navBack}
        hitSlop={8}
        testID={testID}
      >
        <Feather name={closeIcon} size={22} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.navTitle, { color: colors.mutedForeground }]}>
        {title}
      </Text>
      <View style={{ width: 28 }} />
    </View>
  );
}

function SessionFlow() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, completeSession } = useApp();
  const haptic = useHaptic();
  const sounds = useRestSounds();

  const plan = data ? planForDate(data) : null;
  const rounds = plan?.rounds ?? [];
  const totalRounds = SESSION_ROUNDS;
  const restDuration = data?.settings.restSeconds ?? 60;

  const [phase, setPhase] = useState<Phase>("work");
  const [round, setRound] = useState<number>(1);
  const [reps, setReps] = useState<number[]>([]);
  const [restLeft, setRestLeft] = useState<number>(restDuration);
  const [rpe, setRpe] = useState<number | null>(null);
  const [pains, setPains] = useState<PainFlag[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [adjusting, setAdjusting] = useState<boolean>(false);
  // Wall-clock deadline for the current rest. JS timers freeze while the app
  // is backgrounded or the screen is locked, so the countdown must be derived
  // from Date.now(), not from accumulated ticks.
  const restEndsAt = useRef<number>(0);

  const startRest = () => {
    restEndsAt.current = Date.now() + restDuration * 1000;
    setRestLeft(restDuration);
    setPhase("rest");
  };

  const adjustRep = (index: number, delta: number) => {
    haptic.light();
    setReps((prev) =>
      prev.map((r, i) =>
        i === index ? Math.max(0, Math.min(MAX_REPS, r + delta)) : r,
      ),
    );
  };

  const showPainBanner =
    phase === "work" && round === 1 && data ? recentPainFlags(data) : false;

  useEffect(() => {
    if (phase !== "rest") return;
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((restEndsAt.current - Date.now()) / 1000),
      );
      setRestLeft(remaining);
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "rest") return;
    if (restLeft === 0) {
      haptic.success();
      sounds.chime();
      setRound((r) => r + 1);
      setPhase("work");
    } else if (restLeft <= 3) {
      sounds.beep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restLeft]);

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 16;
  const currentTarget = rounds[reps.length] ?? rounds[rounds.length - 1] ?? 0;

  const completeRound = () => {
    haptic.light();
    const nextReps = [...reps, currentTarget];
    setReps(nextReps);
    if (nextReps.length < totalRounds) {
      startRest();
    } else {
      setPhase("summary");
    }
  };

  const skipRest = () => {
    restEndsAt.current = Date.now();
    setRestLeft(0);
  };

  const finishEarly = () => {
    Alert.alert("Finish early?", "Your completed rounds will be saved.", [
      { text: "Keep going", style: "cancel" },
      { text: "Finish", onPress: () => setPhase("summary") },
    ]);
  };

  const exit = () => {
    if (reps.length === 0) {
      router.back();
      return;
    }
    Alert.alert("Leave workout?", "This session won't be saved.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await completeSession({
      date: dateKey(),
      level: data.level,
      targetReps: plan?.target ?? reps[0] ?? 0,
      roundsPlanned: totalRounds,
      roundsCompleted: reps.length,
      repsPerRound: reps,
      rpe,
      painFlags: pains,
    });
    haptic.success();
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {phase !== "summary" ? (
        <WorkoutBar
          title={
            phase === "rest" ? "Resting" : `Round ${round} of ${totalRounds}`
          }
          onClose={exit}
          topPad={topPad}
          testID="btn-close-workout"
        />
      ) : null}

      {phase === "work" && (
        <View style={styles.body}>
          <View style={styles.centerWrap}>
            {showPainBanner ? (
              <Callout
                icon="alert-circle"
                tone={colors.warning}
                style={styles.banner}
              >
                You flagged pain recently. Consider fists, handles, or a higher
                incline today.
              </Callout>
            ) : null}

            <Kicker>
              {plan ? `${SESSION_TYPE_LABEL[plan.type]} · ` : ""}
              {LEVEL_INFO[data.level]?.name}
            </Kicker>

            <View style={styles.circleWrap}>
              <BigCircle
                mode="work"
                value={`${currentTarget}`}
                sublabel="reps"
                onPress={completeRound}
                accessibilityLabel={`Complete round, ${currentTarget} push-ups`}
              />
            </View>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Tap the circle when you've completed all reps
            </Text>
          </View>

          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            {reps.length > 0 ? (
              <PrimaryButton
                label="Finish early"
                variant="outline"
                onPress={finishEarly}
                testID="btn-finish-early"
              />
            ) : null}
          </View>
        </View>
      )}

      {phase === "rest" && (
        <View style={styles.body}>
          <View style={styles.centerWrap}>
            <Kicker>Round complete</Kicker>

            <View style={styles.circleWrap}>
              <BigCircle
                mode="rest"
                value={formatSeconds(restLeft)}
                sublabel="rest"
                progress={restLeft / restDuration}
                accessibilityLabel={`Rest, ${restLeft} seconds remaining`}
              />
            </View>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Next: round {round + 1} of {totalRounds} · {rounds[round] ?? 0}{" "}
              reps
            </Text>

            {reps.length > 0 ? (
              <View style={styles.restAdjustRow}>
                <Pressable
                  onPress={() => adjustRep(reps.length - 1, -1)}
                  disabled={(reps[reps.length - 1] ?? 0) <= 0}
                  style={[
                    styles.roundBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity: (reps[reps.length - 1] ?? 0) <= 0 ? 0.4 : 1,
                    },
                  ]}
                  accessibilityLabel="Decrease reps for last round"
                  testID="btn-adjust-minus"
                >
                  <Feather name="minus" size={18} color={colors.foreground} />
                </Pressable>
                <Text
                  style={[styles.restAdjustText, { color: colors.mutedForeground }]}
                  testID="text-adjust-reps"
                >
                  {reps[reps.length - 1]} reps recorded
                </Text>
                <Pressable
                  onPress={() => adjustRep(reps.length - 1, 1)}
                  disabled={(reps[reps.length - 1] ?? 0) >= MAX_REPS}
                  style={[
                    styles.roundBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      opacity:
                        (reps[reps.length - 1] ?? 0) >= MAX_REPS ? 0.4 : 1,
                    },
                  ]}
                  accessibilityLabel="Increase reps for last round"
                  testID="btn-adjust-plus"
                >
                  <Feather name="plus" size={18} color={colors.foreground} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            <PrimaryButton
              label="Skip rest"
              variant="secondary"
              onPress={skipRest}
              testID="btn-skip-rest"
            />
          </View>
        </View>
      )}

      {phase === "summary" && (
        <View style={styles.root}>
          <View style={[styles.summaryHeader, { paddingTop: topPad }]}>
            <View />
            <Pressable
              onPress={() => router.back()}
              style={styles.navBack}
              hitSlop={8}
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.summaryContent,
              { paddingBottom: bottomPad + 12 },
            ]}
          >
            <View style={styles.summaryCenter}>
              <View
                style={[styles.successMark, { borderColor: colors.success }]}
              >
                <Feather name="check" size={22} color={colors.success} />
              </View>
              <Text style={[styles.doneTitle, { color: colors.foreground }]}>
                Exercise complete
              </Text>
              <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
                {reps.length} {reps.length === 1 ? "round" : "rounds"} ·{" "}
                {reps.reduce((a, b) => a + b, 0)} reps total
              </Text>
            </View>

            <Pressable
              onPress={() => setAdjusting((v) => !v)}
              style={styles.adjustLink}
              testID="btn-toggle-adjust"
            >
              <Text style={[styles.ghostAction, { color: colors.primary }]}>
                {adjusting ? "Done adjusting" : "Adjust reps"}
              </Text>
            </Pressable>

            {adjusting ? (
              <Card style={styles.summaryCard}>
                <Text style={[styles.summaryLabel, { color: colors.foreground }]}>
                  Reps per round
                </Text>
                {reps.map((r, i) => (
                  <View key={i} style={styles.adjustRoundRow}>
                    <Text
                      style={[
                        styles.adjustRoundLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Round {i + 1}
                    </Text>
                    <View style={styles.adjustRow}>
                      <Pressable
                        onPress={() => adjustRep(i, -1)}
                        disabled={r <= 0}
                        style={[
                          styles.smallRoundBtn,
                          {
                            borderColor: colors.border,
                            opacity: r <= 0 ? 0.4 : 1,
                          },
                        ]}
                        accessibilityLabel={`Decrease reps for round ${i + 1}`}
                        testID={`btn-adjust-minus-${i + 1}`}
                      >
                        <Feather name="minus" size={16} color={colors.foreground} />
                      </Pressable>
                      <Text
                        style={[styles.adjustValue, { color: colors.foreground }]}
                        testID={`text-round-reps-${i + 1}`}
                      >
                        {r}
                      </Text>
                      <Pressable
                        onPress={() => adjustRep(i, 1)}
                        disabled={r >= MAX_REPS}
                        style={[
                          styles.smallRoundBtn,
                          {
                            borderColor: colors.border,
                            opacity: r >= MAX_REPS ? 0.4 : 1,
                          },
                        ]}
                        accessibilityLabel={`Increase reps for round ${i + 1}`}
                        testID={`btn-adjust-plus-${i + 1}`}
                      >
                        <Feather name="plus" size={16} color={colors.foreground} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: colors.foreground }]}>
                How hard did that feel?
              </Text>
              <View style={styles.rpeScale}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRpe(n)}
                    style={[
                      styles.rpeDot,
                      {
                        backgroundColor:
                          rpe === n ? colors.primary : "transparent",
                        borderColor: rpe === n ? colors.primary : colors.border,
                      },
                    ]}
                    testID={`rpe-${n}`}
                  >
                    <Text
                      style={[
                        styles.rpeDotText,
                        {
                          color:
                            rpe === n
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.rpeCaptionRow}>
                <Text
                  style={[styles.rpeCaption, { color: colors.mutedForeground }]}
                >
                  Easy
                </Text>
                <Text
                  style={[styles.rpeCaption, { color: colors.mutedForeground }]}
                >
                  Max effort
                </Text>
              </View>
            </Card>

            <Card style={styles.summaryCard}>
              <Text style={[styles.summaryLabel, { color: colors.foreground }]}>
                Any pain? (optional)
              </Text>
              <View style={styles.painRow}>
                {PAIN_OPTIONS.map((p) => {
                  const active = pains.includes(p.key);
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() =>
                        setPains((prev) =>
                          active
                            ? prev.filter((x) => x !== p.key)
                            : [...prev, p.key],
                        )
                      }
                      style={[
                        styles.painChip,
                        {
                          backgroundColor: active
                            ? colors.strengthSoft
                            : "transparent",
                          borderColor: active
                            ? colors.destructive
                            : colors.border,
                          borderRadius: colors.radius - 4,
                        },
                      ]}
                      testID={`pain-${p.key}`}
                    >
                      <Text
                        style={[
                          styles.painText,
                          {
                            color: active
                              ? colors.destructive
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {pains.length > 0 ? (
                <Text style={[styles.painNote, { color: colors.mutedForeground }]}>
                  Try fists or push-up handles for wrists, or a higher incline.
                  We'll go easier if this continues.
                </Text>
              ) : null}
            </Card>

            <View style={styles.saveWrap}>
              <PrimaryButton
                label="Done for today"
                onPress={save}
                disabled={saving}
                testID="btn-save-session"
              />
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function MaxTestFlow() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, recordMaxTest } = useApp();
  const haptic = useHaptic();
  const [phase, setPhase] = useState<"intro" | "input">("intro");
  const [reps, setReps] = useState<number>(8);
  const [saving, setSaving] = useState<boolean>(false);

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 16;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await recordMaxTest(reps);
    haptic.success();
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <WorkoutBar
        title="Max test"
        onClose={() => router.back()}
        topPad={topPad}
        closeIcon="chevron-left"
        testID="btn-close-maxtest"
      />

      <ScrollView
        contentContainerStyle={[
          styles.summaryContent,
          styles.maxTestContent,
          { paddingBottom: bottomPad + 12 },
        ]}
      >
        {phase === "intro" ? (
          <View style={styles.maxTestBlock}>
            <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
              One set of {LEVEL_INFO[data.level]?.name.toLowerCase()}. Stop the
              moment your form breaks — never push to absolute failure.
            </Text>

            <View style={styles.tapCounter}>
              <Text style={[styles.tapCounterValue, { color: colors.foreground }]}>
                {reps}
              </Text>
              <Text
                style={[styles.tapCounterLabel, { color: colors.mutedForeground }]}
              >
                reps so far
              </Text>
            </View>

            <View style={styles.maxTestActions}>
              <PrimaryButton
                label="+1 rep"
                icon="plus"
                onPress={() => {
                  haptic.light();
                  setReps((prev) => prev + 1);
                }}
                variant="outline"
                testID="btn-maxtest-plus"
              />
              <PrimaryButton
                label="That's my limit"
                onPress={() => setPhase("input")}
              />
            </View>
          </View>
        ) : (
          <View style={styles.maxTestBlock}>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>
              How many reps?
            </Text>
            <Text
              style={[
                styles.introBody,
                { color: colors.mutedForeground, marginTop: 8 },
              ]}
            >
              Confirm the number of reps you completed with good form.
            </Text>

            <View style={styles.stepperWrap}>
              <Stepper
                value={reps}
                onChange={(v) => setReps(Math.max(1, Math.min(99, v)))}
              />
            </View>

            <View style={styles.maxTestActions}>
              <PrimaryButton
                label="Save result"
                onPress={save}
                disabled={saving}
                testID="btn-save-maxtest"
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBack: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  body: { flex: 1 },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  circleWrap: { marginVertical: 36 },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    textAlign: "center",
  },
  banner: { marginBottom: 28 },

  footer: {
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },

  restAdjustRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 36,
    gap: 16,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  restAdjustText: {
    fontSize: 13,
    fontFamily: font.bodyMedium,
  },

  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  summaryContent: { paddingHorizontal: 24 },
  summaryCenter: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  successMark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  doneTitle: {
    fontSize: 28,
    lineHeight: 36,
    fontFamily: font.display,
    textAlign: "center",
  },
  doneSub: {
    fontSize: 14,
    fontFamily: font.body,
    marginTop: 6,
  },

  adjustLink: { alignItems: "center", paddingVertical: 12 },
  ghostAction: { fontSize: 14, fontFamily: font.bodySemi },

  summaryCard: { marginTop: 12, gap: 16 },
  summaryLabel: { fontSize: 15, fontFamily: font.bodySemi },

  adjustRoundRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adjustRoundLabel: { fontSize: 14, fontFamily: font.body },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  smallRoundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  adjustValue: {
    fontSize: 20,
    fontFamily: font.display,
    minWidth: 28,
    textAlign: "center",
  },

  rpeScale: { flexDirection: "row", width: "100%", gap: 5 },
  rpeDot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  rpeDotText: { fontSize: 13, fontFamily: font.bodyMedium },
  rpeCaptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: -4,
  },
  rpeCaption: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  painRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  painChip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  painText: { fontSize: 14, fontFamily: font.bodyMedium },
  painNote: { fontSize: 13, lineHeight: 19, fontFamily: font.body },

  saveWrap: { marginTop: 32, marginBottom: 16 },

  maxTestContent: { flexGrow: 1, justifyContent: "center" },
  maxTestBlock: { alignItems: "center", width: "100%" },
  introBody: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.body,
    textAlign: "center",
    maxWidth: 300,
  },
  tapCounter: { alignItems: "center", marginVertical: 36 },
  tapCounterValue: {
    fontFamily: font.display,
    fontSize: 96,
    lineHeight: 110,
  },
  tapCounterLabel: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  stepperWrap: { marginVertical: 36 },
  maxTestActions: { width: "100%", maxWidth: 280, gap: 12 },
});
