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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlankMark } from "@/components/PlankMark";
import { Callout, MaxValueField, PrimaryButton, font } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { DEFAULT_EXERCISE_ID, getExercise } from "@/lib/exercises";

type Step = "welcome" | "setup" | "maxtest";

// Onboarding calibrates the track a fresh install starts with.
const def = getExercise(DEFAULT_EXERCISE_ID);

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();

  const [step, setStep] = useState<Step>("welcome");
  const [cardio, setCardio] = useState<boolean>(false);
  const [joints, setJoints] = useState<boolean>(false);
  const [pain, setPain] = useState<boolean>(false);
  const [maxRepsText, setMaxRepsText] = useState<string>("");

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 46 : insets.bottom + 12;

  const maxValue = def.format.parseValue(maxRepsText);
  const maxValid = maxValue !== null;

  const finish = async () => {
    if (maxValue === null) return;
    await completeOnboarding({
      maxValue,
      health: { cardio, joints, pain, acknowledged: true },
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
          {step === "maxtest" ? def.copy.maxTestNavTitle : "Before you start"}
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
            <View>
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
              {def.copy.maxTestIntro}
            </Text>

            <View style={styles.maxFieldWrap}>
              <MaxValueField
                value={maxRepsText}
                onChangeText={setMaxRepsText}
                unitLabel={def.format.unitLabel}
                mask={def.format.maskInput}
                maxLength={def.format.inputMaxLength}
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
  welcomeAction: {
    width: "100%",
    maxWidth: 300,
    marginTop: 56,
  },

  sectionLabel: {
    fontSize: 24,
    lineHeight: 31,
    fontFamily: font.display,
    marginTop: 8,
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: font.body,
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
