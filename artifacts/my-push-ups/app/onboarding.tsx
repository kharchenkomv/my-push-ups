import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";

import { Card, Chip, PrimaryButton } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { LEVEL_INFO, computeHabitReps } from "@/lib/training";
import type { Level } from "@/lib/types";

type Step = "welcome" | "goal" | "health" | "warning" | "level" | "levelresult" | "maxtest" | "preview";

const GOALS = [20, 30, 50, 100];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();

  const [step, setStep] = useState<Step>("welcome");
  const [goal, setGoal] = useState<number>(50);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [cardio, setCardio] = useState<boolean>(false);
  const [joints, setJoints] = useState<boolean>(false);
  const [pain, setPain] = useState<boolean>(false);
  const [level, setLevelState] = useState<Level>(1);
  const [maxReps, setMaxReps] = useState<number>(8);

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 12;

  const finish = async () => {
    await completeOnboarding({
      level,
      maxReps,
      health: { cardio, joints, pain, acknowledged: true },
      goalReps: goal,
    });
    router.replace("/(tabs)");
  };

  const anyHealthFlag = cardio || joints || pain;

  if (step === "welcome") {
    return (
      <LinearGradient
        colors={["#1E3A8A", "#16255C", "#0F1840"]}
        style={styles.root}
      >
        <View style={[styles.centerBlock, { paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 24 }]}>
          <View style={styles.welcomeRing}>
            <Svg width="96" height="96" viewBox="0 0 96 96" fill="none">
              <Circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,.35)" strokeWidth="7"/>
              <Path d="M48 8 A40 40 0 0 1 85 60" stroke="#FF7A3D" strokeWidth="7" strokeLinecap="round"/>
            </Svg>
            <Svg style={styles.welcomePushup} width="52" height="36" viewBox="0 0 64 40" fill="none">
              <Circle cx="54" cy="11" r="6" fill="white" />
              <Path
                d="M7 31 L44 17"
                stroke="white"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <Path d="M8 31 L4 36" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <Path d="M42 18 L45 34" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
              <Path d="M47 17 L50 33" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={styles.heroTitle}>My Push Ups</Text>
          <Text style={styles.heroSub}>
            A safe, science-based path from your first wall push-up to 100 reps unbroken.
          </Text>
          <View style={styles.spacer} />
          <View style={{width: '100%', maxWidth: 300}}>
            <PrimaryButton
              label="Get started"
              onPress={() => setStep("goal")}
              testID="btn-get-started"
              variant="secondary"
            />
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (step === "levelresult") {
    return (
      <LinearGradient
        colors={["#1E3A8A", "#16255C", "#0F1840"]}
        style={styles.root}
      >
        <View style={[styles.centerBlock, { paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: 24 }]}>
          <Text style={styles.resultEyebrow}>Your starting level</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>L{level}</Text>
          </View>
          <Text style={styles.heroTitle}>Level {level} — {LEVEL_INFO[level]?.name}</Text>
          <Text style={styles.heroSub}>
            {LEVEL_INFO[level]?.description} You'll progress to harder variations as your strength builds.
          </Text>
          
          <View style={styles.levelTrack}>
            {LEVEL_INFO.map((_, i) => (
              <View key={i} style={[
                styles.levelTrackStep,
                i < level && styles.levelTrackStepDone,
                i === level && styles.levelTrackStepCurrent
              ]}>
                <Text style={[
                  styles.levelTrackText,
                  i <= level && styles.levelTrackTextDone
                ]}>L{i}</Text>
              </View>
            ))}
          </View>

          <View style={styles.spacer} />
          <View style={{width: '100%', maxWidth: 300}}>
            <PrimaryButton
              label="Run the max-rep test"
              onPress={() => setStep("maxtest")}
              variant="secondary"
            />
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: topPad, backgroundColor: colors.surface }]}>
        {step !== "health" && step !== "warning" ? (
          <Pressable onPress={() => {
            if (step === "goal") setStep("welcome");
            else if (step === "level") setStep("health");
            else if (step === "maxtest") setStep("levelresult");
            else if (step === "preview") setStep("maxtest");
          }} style={styles.navBack}>
            <Feather name="chevron-left" size={24} color={colors.primary} />
          </Pressable>
        ) : <View style={{width: 28}} />}
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {step === "goal" ? "Your goal" :
           step === "health" || step === "warning" ? "Before we start" :
           step === "level" ? "Find your level" :
           step === "maxtest" ? "Max-rep test" : ""}
        </Text>
        <View style={{width: 28}} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 20 },
          (step === "warning" || step === "maxtest") && styles.contentCenter
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {step === "goal" && (
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              What's your goal?
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Continuous push-ups you want to reach. You can change this later.
            </Text>
            <View style={styles.chipRow}>
              {GOALS.map((g) => (
                <Chip
                  key={g}
                  label={`${g}`}
                  active={goal === g && customGoal === ""}
                  onPress={() => {
                    setGoal(g);
                    setCustomGoal("");
                  }}
                />
              ))}
            </View>
            <TextInput
              style={[
                styles.goalInput,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.card,
                },
              ]}
              placeholder="Custom goal"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={customGoal}
              onChangeText={(t) => {
                setCustomGoal(t);
                const n = parseInt(t, 10);
                if (!Number.isNaN(n) && n > 0) setGoal(n);
              }}
            />
            <View style={styles.spacer} />
            <PrimaryButton
              label="Continue"
              onPress={() => setStep("health")}
              testID="btn-goal-continue"
            />
          </View>
        )}

        {step === "health" && (
          <View>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.dotActive, { backgroundColor: colors.secondary }]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Quick health check
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Answer honestly — this keeps your plan safe.
            </Text>
            <View style={{marginTop: 16, gap: 12}}>
              <QuestionCard
                label="Cardiovascular disease or uncontrolled hypertension?"
                value={cardio}
                onChange={setCardio}
              />
              <QuestionCard
                label="Major joint or spine problems?"
                value={joints}
                onChange={setJoints}
              />
              <QuestionCard
                label="Current chest, shoulder, or wrist pain?"
                value={pain}
                onChange={setPain}
              />
            </View>
            <View style={styles.spacer} />
            <PrimaryButton
              label="Continue"
              onPress={() => setStep(anyHealthFlag ? "warning" : "level")}
              testID="btn-health-continue"
            />
          </View>
        )}

        {step === "warning" && (
          <View style={styles.centerCol}>
            <View
              style={[styles.warnIcon, { backgroundColor: colors.accent }]}
            >
              <Feather
                name="alert-triangle"
                size={28}
                color={colors.warning}
              />
            </View>
            <Text style={[styles.title, { color: colors.foreground, textAlign: "center" }]}>
              Please talk to a doctor first
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground, textAlign: "center", maxWidth: 260 }]}>
              Based on your answers, we recommend consulting a physician or qualified health professional before starting this program. This app is not a substitute for medical advice.
            </Text>
            <View style={styles.spacer} />
            <PrimaryButton
              label="Proceed with caution"
              onPress={() => setStep("level")}
              testID="btn-ack-warning"
              variant="warning"
            />
          </View>
        )}

        {step === "level" && (
          <View>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.dotDone, { backgroundColor: colors.primary }]} />
              <View style={[styles.dot, styles.dotActive, { backgroundColor: colors.secondary }]} />
              <View style={styles.dot} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Can you do 8 full push-ups with good form?
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Chest to near floor, straight body line, full lockout.
            </Text>
            <View style={styles.optionList}>
              <OptionCard
                label="Yes, easily — 8 or more"
                selected={level === 3}
                onPress={() => { setLevelState(3); setStep("levelresult"); }}
                testID="level-card-3"
              />
              <OptionCard
                label="A few, but not 8 with good form"
                selected={level === 2}
                onPress={() => { setLevelState(2); setStep("levelresult"); }}
                testID="level-card-2"
              />
              <OptionCard
                label="I can do knee push-ups only"
                selected={level === 1}
                onPress={() => { setLevelState(1); setStep("levelresult"); }}
                testID="level-card-1"
              />
              <OptionCard
                label="Not even one knee push-up yet"
                selected={level === 0}
                onPress={() => { setLevelState(0); setStep("levelresult"); }}
                testID="level-card-0"
              />
            </View>
          </View>
        )}

        {step === "maxtest" && (
          <View style={styles.centerCol}>
            <Text style={[styles.body, { color: colors.mutedForeground, textAlign: "center", maxWidth: 300 }]}>
              One set of {LEVEL_INFO[level]?.name.toLowerCase()}. Stop the moment your form breaks — never push to absolute failure.
            </Text>
            <View style={styles.tapCounter}>
              <Text style={[styles.tapCounterValue, { color: colors.primary }]}>{maxReps}</Text>
              <Text style={styles.tapCounterLabel}>reps so far</Text>
            </View>
            <View style={{width: 220, gap: 16, marginTop: 32}}>
              <PrimaryButton
                label="+1 rep"
                onPress={() => setMaxReps(r => r + 1)}
                variant="ghost"
                testID="btn-maxtest-plus"
              />
              <PrimaryButton
                label="That's my limit"
                onPress={() => setStep("preview")}
                testID="btn-maxtest-confirm"
              />
            </View>
          </View>
        )}

        {step === "preview" && (
          <View>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.dotDone, { backgroundColor: colors.primary }]} />
              <View style={[styles.dot, styles.dotDone, { backgroundColor: colors.primary }]} />
              <View style={[styles.dot, styles.dotDone, { backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Your plan is ready
            </Text>
            <Card style={styles.previewCard}>
              <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>
                Daily habit
              </Text>
              <Text style={[styles.previewValue, { color: colors.foreground }]}>
                1 round of {computeHabitReps(maxReps)}
              </Text>
              <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
                A quick morning set — about a minute. Add a bonus round when
                you feel good.
              </Text>
            </Card>
            <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 12 }]}>
              Do it most days of the week and your reps go up automatically.
              Goal: {goal} continuous push-ups.
            </Text>
            <View style={styles.spacer} />
            <PrimaryButton
              label="Start Day 1"
              onPress={finish}
              testID="btn-start-day-1"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function QuestionCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.questionCard, { backgroundColor: colors.muted }]}>
      <Text style={[styles.questionText, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.pillToggle}>
        <Pressable
          onPress={() => onChange(true)}
          style={[styles.pill, value ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.pillText, value ? { color: colors.primaryForeground } : { color: colors.mutedForeground }]}>Yes</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(false)}
          style={[styles.pill, !value ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.pillText, !value ? { color: colors.primaryForeground } : { color: colors.mutedForeground }]}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OptionCard({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[
        styles.optionCard,
        { backgroundColor: colors.muted, borderColor: "transparent" },
        selected && { backgroundColor: "rgba(30,58,138,0.1)", borderColor: colors.primary }
      ]}
    >
      <Text style={[styles.optionText, { color: colors.foreground }]}>{label}</Text>
      <Feather name="chevron-right" size={20} color={selected ? colors.primary : colors.mutedForeground} />
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  format?: (v: number) => string;
}) {
  const colors = useColors();
  return (
    <View style={styles.stepperRow}>
      <Pressable
        onPress={() => onChange(value - step)}
        style={[styles.stepperBtn, { backgroundColor: colors.muted }]}
        testID="stepper-minus"
      >
        <Feather name="minus" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.stepperValue, { color: colors.foreground }]}>
        {format ? format(value) : value}
      </Text>
      <Pressable
        onPress={() => onChange(value + step)}
        style={[styles.stepperBtn, { backgroundColor: colors.muted }]}
        testID="stepper-plus"
      >
        <Feather name="plus" size={22} color={colors.foreground} />
      </Pressable>
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
  },
  navBack: {
    width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
  },
  navTitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 16,
  },
  content: { paddingHorizontal: 24, flexGrow: 1, paddingTop: 24 },
  contentCenter: { alignItems: "center", justifyContent: "center" },
  centerCol: { alignItems: "center", justifyContent: "center", flex: 1, width: '100%' },
  centerBlock: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  welcomeRing: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    position: "relative",
  },
  welcomePushup: {
    position: "absolute",
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
    color: "#FFFFFF",
  },
  heroSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    color: "rgba(255,255,255,0.75)",
    maxWidth: 240,
  },
  
  progressDots: { flexDirection: "row", gap: 8, marginBottom: 24 },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: "#E4E7F0" },
  dotActive: { },
  dotDone: { },
  
  title: {
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 8,
    lineHeight: 30,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "left",
  },
  spacer: { height: 32 },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
  },
  goalInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    marginTop: 12,
  },
  
  questionCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  questionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
  },
  pillToggle: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    alignItems: "center",
  },
  pillText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  
  warnIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  
  optionList: { gap: 12, marginTop: 12 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  
  resultEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  levelBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FF7A3D",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#FF7A3D",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  levelBadgeText: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 32,
    color: "#FFFFFF",
  },
  levelTrack: { flexDirection: "row", gap: 8, marginVertical: 32 },
  levelTrackStep: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  levelTrackStepDone: { backgroundColor: "rgba(255,255,255,0.22)" },
  levelTrackStepCurrent: { backgroundColor: "#FF7A3D" },
  levelTrackText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
  },
  levelTrackTextDone: { color: "#FFFFFF" },
  
  tapCounter: { alignItems: "center", marginVertical: 32 },
  tapCounterValue: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 80,
    lineHeight: 84,
  },
  tapCounterLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#6B6E85",
  },
  
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginTop: 12,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 44,
    fontFamily: "SpaceGrotesk_700Bold",
    minWidth: 100,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  previewCard: { marginBottom: 16 },
  previewLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewValue: {
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
    marginTop: 4,
  },
  previewNote: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
