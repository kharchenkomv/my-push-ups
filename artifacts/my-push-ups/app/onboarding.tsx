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

import { Chip, PrimaryButton } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { LEVEL_INFO } from "@/lib/training";
import type { Level } from "@/lib/types";

type Step = "welcome" | "setup" | "maxtest";

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
  const [level, setLevelState] = useState<Level | null>(null);
  const [maxReps, setMaxReps] = useState<number>(8);

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 12;

  const finish = async () => {
    await completeOnboarding({
      level: level ?? 1,
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
              onPress={() => setStep("setup")}
              testID="btn-get-started"
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
        <Pressable
          onPress={() => setStep(step === "maxtest" ? "setup" : "welcome")}
          style={styles.navBack}
        >
          <Feather name="chevron-left" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {step === "maxtest" ? "Max-rep test" : "Set up your plan"}
        </Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 20 },
          step === "maxtest" && styles.contentCenter,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {step === "setup" && (
          <View>
            {/* Goal */}
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
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

            {/* Health */}
            <Text
              style={[styles.sectionLabel, styles.sectionGap, { color: colors.foreground }]}
            >
              Quick health check
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Answer honestly — this keeps your plan safe.
            </Text>
            <View style={{ gap: 10, marginTop: 4 }}>
              <HealthToggle
                label="Cardiovascular disease or uncontrolled hypertension?"
                value={cardio}
                onChange={setCardio}
              />
              <HealthToggle
                label="Major joint or spine problems?"
                value={joints}
                onChange={setJoints}
              />
              <HealthToggle
                label="Current chest, shoulder, or wrist pain?"
                value={pain}
                onChange={setPain}
              />
            </View>
            {anyHealthFlag ? (
              <View style={[styles.warnCallout, { backgroundColor: colors.accent }]}>
                <Feather name="alert-triangle" size={18} color={colors.warning} />
                <Text style={[styles.warnCalloutText, { color: colors.foreground }]}>
                  Consult a physician or qualified health professional before
                  starting this program. This app is not a substitute for medical
                  advice.
                </Text>
              </View>
            ) : null}

            {/* Level */}
            <Text
              style={[styles.sectionLabel, styles.sectionGap, { color: colors.foreground }]}
            >
              Can you do 8 full push-ups with good form?
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Chest to near floor, straight body line, full lockout.
            </Text>
            <View style={styles.optionList}>
              <OptionCard
                label="Yes, easily — 8 or more"
                selected={level === 3}
                onPress={() => setLevelState(3)}
                testID="level-card-3"
              />
              <OptionCard
                label="A few, but not 8 with good form"
                selected={level === 2}
                onPress={() => setLevelState(2)}
                testID="level-card-2"
              />
              <OptionCard
                label="I can do knee push-ups only"
                selected={level === 1}
                onPress={() => setLevelState(1)}
                testID="level-card-1"
              />
              <OptionCard
                label="Not even one knee push-up yet"
                selected={level === 0}
                onPress={() => setLevelState(0)}
                testID="level-card-0"
              />
            </View>

            <View style={styles.spacer} />
            <PrimaryButton
              label="Continue"
              onPress={() => setStep("maxtest")}
              disabled={level === null}
              testID="btn-setup-continue"
            />
          </View>
        )}

        {step === "maxtest" && (
          <View style={styles.centerCol}>
            <Text style={[styles.body, { color: colors.mutedForeground, textAlign: "center", maxWidth: 300 }]}>
              One set of {LEVEL_INFO[level ?? 1]?.name.toLowerCase()}. Stop the moment your form breaks — never push to absolute failure.
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
                onPress={finish}
                testID="btn-maxtest-confirm"
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function HealthToggle({
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
    <View
      style={[
        styles.healthRow,
        {
          backgroundColor: value ? colors.accent : colors.muted,
          borderColor: value ? colors.warning : "transparent",
        },
      ]}
    >
      <Text style={[styles.healthLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#FFFFFF"
      />
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
  sectionLabel: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 6,
    lineHeight: 26,
  },
  sectionGap: { marginTop: 32 },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  healthLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  warnCallout: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginTop: 14,
    alignItems: "flex-start",
  },
  warnCalloutText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
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
