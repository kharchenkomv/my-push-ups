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
import { LinearGradient } from "expo-linear-gradient";

import { BigCircle } from "@/components/BigCircle";
import { Card, PrimaryButton } from "@/components/UI";
import { Stepper } from "@/app/onboarding";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  SESSION_REST_SECONDS,
  SESSION_ROUNDS,
  LEVEL_INFO,
  dateKey,
  formatSeconds,
  recentPainFlags,
  sessionRoundReps,
} from "@/lib/training";
import type { PainFlag } from "@/lib/types";

type Phase = "work" | "rest" | "summary";

const MAX_REPS = 99;

const PAIN_OPTIONS: { key: PainFlag; label: string }[] = [
  { key: "wrist", label: "Wrist" },
  { key: "shoulder", label: "Shoulder" },
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

function SessionFlow() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, completeSession } = useApp();
  const haptic = useHaptic();
  const sounds = useRestSounds();

  const target = data ? sessionRoundReps(data) : 3;
  const totalRounds = SESSION_ROUNDS;
  const restDuration = SESSION_REST_SECONDS;

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
  const completeRound = () => {
    haptic.light();
    const nextReps = [...reps, target];
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
      targetReps: target,
      roundsPlanned: totalRounds,
      roundsCompleted: reps.length,
      repsPerRound: reps,
      rpe,
      painFlags: pains,
    });
    haptic.success();
    router.back();
  };

  const gradientColors = phase === "summary" 
    ? [colors.background, colors.background] as [string, string]
    : ["#10132B", "#0A0C1E"] as [string, string];

  return (
    <LinearGradient colors={gradientColors} style={styles.root}>
      {phase !== "summary" && (
        <View style={[styles.navBar, { paddingTop: topPad }]}>
          <Pressable onPress={exit} style={styles.navBack} testID="btn-close-workout">
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.navTitle}>
            {phase === "rest" ? "Resting" : `Round ${round} of ${totalRounds}`}
          </Text>
          <View style={{ width: 28 }} />
        </View>
      )}

      {phase === "work" && (
        <View style={styles.body}>
          <View style={styles.centerWrap}>
            {showPainBanner ? (
              <View style={[styles.banner, { backgroundColor: colors.accent }]}>
                <Feather
                  name="alert-circle"
                  size={18}
                  color={colors.accentForeground}
                />
                <Text
                  style={[styles.bannerText, { color: colors.accentForeground }]}
                >
                  You flagged pain recently. Consider fists, handles, or a higher
                  incline today.
                </Text>
              </View>
            ) : null}
            <Text style={styles.sessionLevelTag}>
              Level {data.level} · {LEVEL_INFO[data.level]?.name}
            </Text>
            
            <View style={{ marginVertical: 40 }}>
              <BigCircle
                mode="work"
                value={`${target}`}
                sublabel="reps"
                onPress={completeRound}
                accessibilityLabel={`Complete round, ${target} push-ups`}
                color={colors.habit}
              />
            </View>
            
            <Text style={styles.sessionHint}>
              Tap the circle when you've completed all reps
            </Text>
          </View>
          
          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            {reps.length > 0 ? (
              <PrimaryButton
                label="Finish early"
                variant="ghost-light"
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
            <Text style={styles.sessionLevelTag}>
              Nice work — round complete
            </Text>
            
            <View style={{ marginVertical: 40 }}>
              <BigCircle
                mode="rest"
                value={formatSeconds(restLeft)}
                sublabel="rest"
                progress={restLeft / restDuration}
                accessibilityLabel={`Rest, ${restLeft} seconds remaining`}
                color={colors.rest}
              />
            </View>
            
            <Text style={styles.sessionHint}>
              Next: Round {round + 1} of {totalRounds}
            </Text>

            {reps.length > 0 ? (
              <View style={styles.restAdjustRow}>
                <Pressable
                  onPress={() => adjustRep(reps.length - 1, -1)}
                  disabled={(reps[reps.length - 1] ?? 0) <= 0}
                  style={[
                    styles.restAdjustBtn,
                    {
                      opacity: (reps[reps.length - 1] ?? 0) <= 0 ? 0.4 : 1,
                    },
                  ]}
                  accessibilityLabel="Decrease reps for last round"
                  testID="btn-adjust-minus"
                >
                  <Feather name="minus" size={20} color="#FFFFFF" />
                </Pressable>
                <Text
                  style={styles.restAdjustText}
                  testID="text-adjust-reps"
                >
                  {reps[reps.length - 1]} reps recorded
                </Text>
                <Pressable
                  onPress={() => adjustRep(reps.length - 1, 1)}
                  disabled={(reps[reps.length - 1] ?? 0) >= MAX_REPS}
                  style={[
                    styles.restAdjustBtn,
                    {
                      opacity: (reps[reps.length - 1] ?? 0) >= MAX_REPS ? 0.4 : 1,
                    },
                  ]}
                  accessibilityLabel="Increase reps for last round"
                  testID="btn-adjust-plus"
                >
                  <Feather name="plus" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            <PrimaryButton
              label="Skip rest"
              variant="primary"
              onPress={skipRest}
              testID="btn-skip-rest"
            />
          </View>
        </View>
      )}

      {phase === "summary" && (
        <View style={styles.summaryRoot}>
          <View style={[styles.summaryHeader, { paddingTop: topPad }]}>
            <View />
            <Pressable
              onPress={() => router.back()}
              style={[styles.navBack, { backgroundColor: colors.muted }]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.summaryContent,
              { paddingBottom: bottomPad + 12 },
            ]}
          >
            <View style={styles.summaryCenter}>
              <View style={[styles.successBadge, { backgroundColor: "rgba(31,138,76,0.15)" }]}>
                <Feather name="check" size={32} color={colors.success} />
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
                      style={[styles.adjustRoundLabel, { color: colors.foreground }]}
                    >
                      Round {i + 1}
                    </Text>
                    <View style={styles.adjustRow}>
                      <Pressable
                        onPress={() => adjustRep(i, -1)}
                        disabled={r <= 0}
                        style={[
                          styles.adjustBtn,
                          {
                            backgroundColor: colors.muted,
                            opacity: r <= 0 ? 0.4 : 1,
                          },
                        ]}
                        accessibilityLabel={`Decrease reps for round ${i + 1}`}
                        testID={`btn-adjust-minus-${i + 1}`}
                      >
                        <Feather name="minus" size={18} color={colors.foreground} />
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
                          styles.adjustBtn,
                          {
                            backgroundColor: colors.muted,
                            opacity: r >= MAX_REPS ? 0.4 : 1,
                          },
                        ]}
                        accessibilityLabel={`Increase reps for round ${i + 1}`}
                        testID={`btn-adjust-plus-${i + 1}`}
                      >
                        <Feather name="plus" size={18} color={colors.foreground} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Text style={[styles.rpeTitle, { color: colors.foreground }]}>
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
                        backgroundColor: rpe === n ? colors.primary : colors.card,
                        borderColor: rpe === n ? colors.primary : colors.border,
                        borderWidth: 1,
                      },
                    ]}
                    testID={`rpe-${n}`}
                  >
                    <Text
                      style={[
                        styles.rpeDotText,
                        {
                          color: rpe === n ? colors.primaryForeground : colors.mutedForeground,
                        },
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.rpeCaptionRow}>
                <Text style={styles.rpeCaption}>Easy</Text>
                <Text style={styles.rpeCaption}>Max effort</Text>
              </View>
            </View>

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
                            ? "rgba(255,122,61,0.15)"
                            : colors.card,
                          borderColor: active ? colors.secondary : colors.border,
                        },
                      ]}
                      testID={`pain-${p.key}`}
                    >
                      <Text
                        style={[
                          styles.painText,
                          {
                            color: active
                              ? colors.secondary
                              : colors.foreground,
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
                <Text
                  style={[styles.painNote, { color: colors.mutedForeground }]}
                >
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
    </LinearGradient>
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
    <View style={[styles.summaryRoot, { backgroundColor: colors.background }]}>
      <View style={[styles.navBarClassic, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.navBackClassic}
          testID="btn-close-maxtest"
        >
          <Feather name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.navTitleClassic, { color: colors.foreground }]}>
          Max test
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.summaryContent,
          { paddingBottom: bottomPad + 12 },
        ]}
      >
        {phase === "intro" ? (
          <View style={{ alignItems: "center", marginTop: 24 }}>
            <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
              One set of {LEVEL_INFO[data.level]?.name.toLowerCase()}. Stop the moment your form breaks — never push to absolute failure.
            </Text>
            
            <View style={styles.tapCounter}>
              <Text style={[styles.tapCounterValue, { color: colors.primary }]}>{reps}</Text>
              <Text style={styles.tapCounterLabel}>reps so far</Text>
            </View>
            
            <View style={{ width: "100%", gap: 16, marginTop: 40, maxWidth: 300 }}>
              <PrimaryButton
                label="+1 rep"
                onPress={() => {
                  haptic.light();
                  setReps((prev) => prev + 1);
                }}
                variant="ghost"
                testID="btn-maxtest-plus"
              />
              <PrimaryButton
                label="That's my limit"
                onPress={() => setPhase("input")}
              />
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center", marginTop: 24 }}>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>
              How many reps?
            </Text>
            <Text style={[styles.introBody, { color: colors.mutedForeground, marginTop: 8 }]}>
              Confirm the number of reps you completed with good form.
            </Text>
            
            <View style={{ marginVertical: 32 }}>
              <Stepper
                value={reps}
                onChange={(v) => setReps(Math.max(1, Math.min(99, v)))}
              />
            </View>

            <View style={{ width: "100%", maxWidth: 300 }}>
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
  summaryRoot: { flex: 1 },
  
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  navBack: {
    width: 32, height: 32,
    alignItems: "center", justifyContent: "center",
    borderRadius: 16,
  },
  navTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  
  navBarClassic: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  navBackClassic: {
    width: 32, height: 32,
    alignItems: "center", justifyContent: "center",
  },
  navTitleClassic: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 16,
  },
  
  body: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  
  sessionLevelTag: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
  sessionHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  
  footer: {
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  
  restAdjustRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
    gap: 16,
  },
  restAdjustBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  restAdjustText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },

  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  summaryContent: {
    paddingHorizontal: 24,
  },
  summaryCenter: {
    alignItems: "center",
    marginBottom: 24,
  },
  successBadge: {
    width: 60, height: 60,
    borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  doneSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  
  adjustLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
  ghostAction: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  
  summaryCard: {
    marginTop: 16,
    padding: 16,
    gap: 16,
  },
  summaryLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  
  adjustRoundRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  adjustRoundLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  adjustBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  adjustValue: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    minWidth: 24,
    textAlign: "center",
  },
  
  rpeTitle: {
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 12,
  },
  rpeScale: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  rpeDot: {
    width: 34, height: 34,
    borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  rpeDotText: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  rpeCaptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 8,
    marginTop: 6,
  },
  rpeCaption: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#A7A9BC",
  },

  painRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  painChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
  },
  painText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  painNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  
  addRoundWrap: {
    marginTop: 16,
  },
  saveWrap: {
    marginTop: 32,
    marginBottom: 16,
  },
  
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  
  introBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    textAlign: "center",
  },
  tapCounter: {
    alignItems: "center",
    marginVertical: 24,
  },
  tapCounterValue: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 72,
    lineHeight: 76,
  },
  tapCounterLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6B6E85",
  },
});
