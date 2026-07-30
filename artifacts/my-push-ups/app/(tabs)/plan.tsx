import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExercisePlanSection } from "@/components/exercise/ExercisePlanSection";
import { ScreenTitle } from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useEnabledExercises } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data } = useApp();
  const views = useEnabledExercises();

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const showsName = views.length > 1;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <ScreenTitle subtitle="Your programme">Plan</ScreenTitle>

      <View style={styles.stack}>
        {views.map((v) => (
          <ExercisePlanSection key={v.id} view={v} showsName={showsName} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  stack: { gap: 8 },
});
