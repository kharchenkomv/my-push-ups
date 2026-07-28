import { Feather } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BigCircle } from "@/components/BigCircle";
import {
  Callout,
  Card,
  MaxValueField,
  PrimaryButton,
  font,
} from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useExercise } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { clamp, dateKey, formatSeconds } from "@/lib/core";
import { confirmAction } from "@/lib/dialogs";
import { DEFAULT_EXERCISE_ID, getExercise, isExerciseId } from "@/lib/exercises";
import type { ExerciseDef } from "@/lib/exercises/types";
import type { ExerciseId, PainFlag } from "@/lib/types";

type Phase = "work" | "rest" | "summary";

const STEP_SIZE = 54;

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
  const { track, exerciseId } = useLocalSearchParams<{
    track?: string;
    exerciseId?: string;
  }>();
  // An absent or unrecognised id falls back to the default track, so a stale
  // deep link can never land the user on a blank screen.
  const id: ExerciseId = isExerciseId(exerciseId)
    ? exerciseId
    : DEFAULT_EXERCISE_ID;
  const def = getExercise(id);

  if (track === "maxtest") return <MaxTestFlow id={id} def={def} />;
  return <SessionFlow id={id} def={def} />;
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

/**
 * The rule across the top of both workout screens: one segment per round, so
 * "how far in am I" is answered before the eye reaches the circle. The current
 * round reads as a half-lit segment between the done ones and the ones to come.
 */
function RoundTrack({
  completed,
  total,
  label,
  tone,
}: {
  completed: number;
  total: number;
  label: string;
  tone: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.track} testID="round-track">
      <View style={styles.trackBar}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.trackSeg,
              {
                backgroundColor: i <= completed ? tone : colors.border,
                opacity: i === completed ? 0.4 : 1,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.trackLabel, { color: tone }]} testID="text-round-label">
        {label}
      </Text>
    </View>
  );
}

/** Round tap target flanking the circle, for nudging the rep count. */
function StepButton({
  icon,
  onPress,
  disabled,
  size,
  accessibilityLabel,
  testID,
}: {
  icon: "plus" | "minus";
  onPress: () => void;
  disabled?: boolean;
  size: number;
  accessibilityLabel: string;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.stepBtn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.muted : colors.card,
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Feather name={icon} size={22} color={colors.foreground} />
    </Pressable>
  );
}

function SessionFlow({ id, def }: { id: ExerciseId; def: ExerciseDef }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { data } = useApp();
  const view = useExercise(id);
  const sounds = useRestSounds();

  const plan = view?.plan ?? null;
  const rounds = plan?.rounds ?? [];
  const totalRounds = def.engine.roundsPerSession;
  const maxValue = def.format.bounds.max;
  const restDuration = view?.state.settings.restSeconds ?? 60;

  const [phase, setPhase] = useState<Phase>("work");
  const [round, setRound] = useState<number>(1);
  const [reps, setReps] = useState<number[]>([]);
  const [restLeft, setRestLeft] = useState<number>(restDuration);
  const [rpe, setRpe] = useState<number | null>(null);
  const [pains, setPains] = useState<PainFlag[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [adjusting, setAdjusting] = useState<boolean>(false);
  // What the circle currently reads. Seeded from the prescription, but the
  // user owns it: the +/- steppers let them log what they actually did.
  const [pendingReps, setPendingReps] = useState<number>(0);
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
    setReps((prev) =>
      prev.map((r, i) =>
        i === index ? Math.max(0, Math.min(maxValue, r + delta)) : r,
      ),
    );
  };

  const showPainBanner = phase === "work" && round === 1 && !!view?.recentPain;

  const currentTarget = rounds[reps.length] ?? rounds[rounds.length - 1] ?? 0;

  // Every new round re-seeds the circle with that round's prescription; edits
  // the user makes with the steppers survive until the round is banked.
  // `reps.length` has to be a dependency in its own right: consecutive rounds
  // often share a target, and keying only on the value would carry the previous
  // round's edit into the next one.
  useEffect(() => {
    setPendingReps(currentTarget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps.length, currentTarget]);

  // Re-arm the countdown on the deadline's own second boundaries instead of
  // polling on a fixed cadence. A fixed interval drifts out of phase with the
  // deadline, so the displayed digit lingers or skips by up to a whole tick;
  // aiming each timeout at the next boundary keeps every digit on screen for
  // one real second.
  useEffect(() => {
    if (phase !== "rest") return;
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const msLeft = Math.max(0, restEndsAt.current - Date.now());
      setRestLeft(Math.ceil(msLeft / 1000));
      if (msLeft <= 0) return;
      id = setTimeout(tick, (msLeft % 1000 || 1000) + 20);
    };
    tick();
    return () => {
      if (id !== undefined) clearTimeout(id);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "rest") return;
    if (restLeft === 0) {
      sounds.chime();
      setRound((r) => r + 1);
      setPhase("work");
    } else if (restLeft <= 3) {
      sounds.beep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, restLeft]);

  if (!data || !view) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 16;

  // The circle, its two steppers and the screen gutters have to share one row,
  // so the ring gives way on narrow phones rather than pushing them off-screen.
  const circleSize = clamp(width - 32 - 2 * (STEP_SIZE + 10), 168, 240);

  const completeRound = () => {
    const nextReps = [...reps, pendingReps];
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
    confirmAction({
      title: "Finish early?",
      message: "Your completed rounds will be saved.",
      cancelLabel: "Keep going",
      confirmLabel: "Finish",
      onConfirm: () => setPhase("summary"),
    });
  };

  const exit = () => {
    if (reps.length === 0) {
      router.back();
      return;
    }
    confirmAction({
      title: "Leave workout?",
      message: "This session won't be saved.",
      cancelLabel: "Stay",
      confirmLabel: "Leave",
      destructive: true,
      onConfirm: () => router.back(),
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await view.completeSession({
      date: dateKey(),
      targetValue: plan?.rounds[0] ?? reps[0] ?? 0,
      roundsPlanned: totalRounds,
      roundsCompleted: reps.length,
      valuePerRound: reps,
      rpe,
      painFlags: pains,
    });
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {phase !== "summary" ? (
        <WorkoutBar
          title={
            phase === "rest"
              ? "Resting"
              : plan
                ? `${view.dayMeta.label} · Day ${plan.microPos}`
                : "Workout"
          }
          onClose={exit}
          topPad={topPad}
          testID="btn-close-workout"
        />
      ) : null}

      {phase === "work" && (
        <View style={styles.body}>
          <RoundTrack
            completed={reps.length}
            total={totalRounds}
            label={`Round ${round} of ${totalRounds}`}
            tone={colors.primary}
          />

          <View style={styles.centerWrap}>
            {showPainBanner ? (
              <Callout
                icon="alert-circle"
                tone={colors.warning}
                style={styles.banner}
              >
                {def.copy.painBanner}
              </Callout>
            ) : null}

            <View style={styles.circleRow}>
              <StepButton
                icon="minus"
                size={STEP_SIZE}
                onPress={() => setPendingReps((n) => Math.max(0, n - 1))}
                disabled={pendingReps <= 0}
                accessibilityLabel="One rep fewer this round"
                testID="btn-reps-minus"
              />
              <BigCircle
                mode="work"
                size={circleSize}
                value={def.format.formatValue(pendingReps)}
                sublabel={def.format.unitLabel}
                onPress={completeRound}
                accessibilityLabel={def.copy.circleA11y(round, pendingReps)}
              />
              <StepButton
                icon="plus"
                size={STEP_SIZE}
                onPress={() =>
                  setPendingReps((n) => Math.min(maxValue, n + 1))
                }
                disabled={pendingReps >= maxValue}
                accessibilityLabel="One rep more this round"
                testID="btn-reps-plus"
              />
            </View>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {def.copy.roundHint}
            </Text>
            {/* Only speak up once the count has drifted, so the prescription is
                recoverable without nagging the user who follows it. */}
            <Text
              style={[styles.targetNote, { color: colors.mutedForeground }]}
              testID="text-target-note"
            >
              {pendingReps === currentTarget
                ? "Use − and + if you managed a different number"
                : `Prescribed: ${def.format.formatValue(currentTarget)} ${def.format.unitLabel}`}
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
          <RoundTrack
            completed={reps.length}
            total={totalRounds}
            label={`Round ${round} of ${totalRounds} done`}
            tone={colors.rest}
          />

          <View style={styles.centerWrap}>
            <View style={styles.circleRow}>
              <BigCircle
                mode="rest"
                size={circleSize}
                value={formatSeconds(restLeft)}
                sublabel="rest"
                progress={restLeft / restDuration}
                accessibilityLabel={`Rest, ${restLeft} seconds remaining`}
              />
            </View>

            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Next: round {round + 1} of {totalRounds} ·{" "}
              {def.format.formatValue(rounds[round] ?? 0)} {def.format.unitLabel}
            </Text>
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
                {reps.reduce((a, b) => a + b, 0)} {def.format.unitLabel} total
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
                        disabled={r >= maxValue}
                        style={[
                          styles.smallRoundBtn,
                          {
                            borderColor: colors.border,
                            opacity: r >= maxValue ? 0.4 : 1,
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
                {def.painOptions.map((p) => {
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
                  {def.copy.painNote}
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

function MaxTestFlow({ id, def }: { id: ExerciseId; def: ExerciseDef }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data } = useApp();
  const view = useExercise(id);
  const [text, setText] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  if (!data || !view) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 16;

  const parsed = def.format.parseValue(text);
  const valid = parsed !== null;

  const save = async () => {
    if (saving || parsed === null) return;
    setSaving(true);
    await view.recordMaxTest(parsed);
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.maxTestBlock}>
          <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
            {def.copy.maxTestRetestIntro}
          </Text>

          <View style={styles.maxFieldWrap}>
            <MaxValueField
              value={text}
              onChangeText={setText}
              unitLabel={def.format.unitLabel}
              mask={def.format.maskInput}
              maxLength={def.format.inputMaxLength}
              testID="input-maxtest"
            />
          </View>

          <View style={styles.maxTestActions}>
            <PrimaryButton
              label="Save result"
              onPress={save}
              disabled={!valid || saving}
              testID="btn-save-maxtest"
            />
          </View>
        </View>
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
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 36,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
    textAlign: "center",
  },
  targetNote: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: font.bodyMedium,
    textAlign: "center",
    marginTop: 8,
  },
  banner: { marginBottom: 28 },

  track: {
    paddingHorizontal: 24,
    paddingTop: 22,
    alignItems: "center",
    gap: 10,
  },
  trackBar: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 6,
  },
  trackSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  trackLabel: {
    fontSize: 11,
    fontFamily: font.bodySemi,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  stepBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  footer: {
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
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
  maxFieldWrap: { marginVertical: 36 },
  maxTestActions: { width: "100%", maxWidth: 280, gap: 12 },
});
