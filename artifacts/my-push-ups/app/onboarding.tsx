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
import { PlankMark } from "@/components/PlankMark";
import { Callout, Chip, MaxRepsField, PrimaryButton, font } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Step = "welcome" | "setup" | "maxtest";

const GOALS = [20, 30, 50, 100];

/** The movement's atomic unit — a quiet row of days marked and days missed. */
function DotRow({ count = 12, filled = 4 }: { count?: number; filled?: number }) {
  const colors = useColors();
  return (
    <View style={styles.dotRow}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.markDot,
            {
              backgroundColor: i < filled ? colors.primary : "transparent",
              borderColor: i < filled ? colors.primary : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

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
  const [maxRepsText, setMaxRepsText] = useState<string>("");

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 12;

  const maxReps = parseInt(maxRepsText, 10);
  const maxValid = Number.isFinite(maxReps) && maxReps >= 1 && maxReps <= 999;

  const finish = async () => {
    if (!maxValid) return;
    await completeOnboarding({
      maxReps,
      health: { cardio, joints, pain, acknowledged: true },
      goalReps: goal,
    });
    router.replace("/(tabs)");
  };

  const anyHealthFlag = cardio || joints || pain;

  if (step === "welcome") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.welcomeBlock,
            { paddingTop: topPad, paddingBottom: bottomPad },
          ]}
        >
          <View style={styles.mark}>
            <PlankMark
              size={88}
              ink={colors.foreground}
              tint={colors.primary}
              track={colors.border}
            />
          </View>

          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            My Trainer
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            A safe, science-based path from your first wall push-up to 100 reps
            unbroken.
          </Text>

          <DotRow />

          <View style={styles.welcomeAction}>
            <PrimaryButton
              label="Get started"
              onPress={() => setStep("setup")}
              testID="btn-get-started"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          { paddingTop: topPad, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => setStep(step === "maxtest" ? "setup" : "welcome")}
          style={styles.navBack}
          hitSlop={8}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>
          {step === "maxtest" ? "Max-rep test" : "Set up your plan"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 24 },
          step === "maxtest" && styles.contentCenter,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {step === "setup" && (
          <View>
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

            <View style={styles.sectionGap}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                Quick health check
              </Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                Answer honestly — this keeps your plan safe.
              </Text>
            </View>
            <View style={styles.toggleStack}>
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
              <Callout
                icon="alert-triangle"
                tone={colors.warning}
                style={styles.warnGap}
              >
                Consult a physician or qualified health professional before
                starting this program. This app is not a substitute for medical
                advice.
              </Callout>
            ) : null}

            <View style={styles.continueWrap}>
              <PrimaryButton
                label="Continue"
                onPress={() => setStep("maxtest")}
                testID="btn-setup-continue"
              />
            </View>
          </View>
        )}

        {step === "maxtest" && (
          <View style={styles.centerCol}>
            <Text
              style={[
                styles.body,
                styles.maxTestIntro,
                { color: colors.mutedForeground },
              ]}
            >
              One set of push-ups to your technical limit. Stop the moment your
              form breaks — never push to absolute failure. This sizes your whole
              plan, so type only the clean reps.
            </Text>

            <View style={styles.maxFieldWrap}>
              <MaxRepsField
                value={maxRepsText}
                onChangeText={setMaxRepsText}
                testID="input-onboarding-max"
              />
            </View>

            <View style={styles.maxTestActions}>
              <PrimaryButton
                label="That's my limit"
                onPress={finish}
                disabled={!maxValid}
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
          backgroundColor: colors.card,
          borderColor: value ? colors.warning : colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text style={[styles.healthLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.input }}
        thumbColor="#ffffff"
      />
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
    fontFamily: font.display,
    fontSize: 18,
  },

  content: { paddingHorizontal: 24, flexGrow: 1, paddingTop: 28 },
  contentCenter: { alignItems: "center", justifyContent: "center" },
  centerCol: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
  },

  welcomeBlock: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  mark: { marginBottom: 28 },
  heroTitle: {
    fontSize: 44,
    lineHeight: 52,
    fontFamily: font.display,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: font.body,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 280,
  },
  dotRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 40,
  },
  markDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  welcomeAction: {
    width: "100%",
    maxWidth: 300,
    marginTop: 48,
  },

  sectionLabel: {
    fontSize: 24,
    lineHeight: 31,
    fontFamily: font.display,
    marginTop: 8,
    marginBottom: 6,
  },
  sectionGap: { marginTop: 40 },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.body,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  goalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: font.body,
    marginTop: 12,
  },

  toggleStack: { gap: 10, marginTop: 16 },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  healthLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: font.body,
  },
  warnGap: { marginTop: 14 },

  optionList: { gap: 10, marginTop: 16 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: font.body,
  },
  optionMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  continueWrap: { marginTop: 40 },

  maxTestIntro: { textAlign: "center", maxWidth: 300 },
  maxFieldWrap: { marginVertical: 40 },
  maxTestActions: { width: "100%", maxWidth: 280, gap: 12 },
});
