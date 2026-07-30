import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Chip, SectionTitle, font } from "@/components/UI";
import type { ExerciseView } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { formatSeconds } from "@/lib/core";

/** Rest and goal controls for one training track. */
export function ExerciseSettingsCard({
  view,
  showsName,
}: {
  view: ExerciseView;
  showsName: boolean;
}) {
  const colors = useColors();
  const { def, state, updateSettings } = view;

  return (
    <View>
      {showsName ? <SectionTitle>{def.copy.name}</SectionTitle> : null}

      <Card>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          Rest between rounds
        </Text>
        <View style={styles.chipRow}>
          {def.restOptions.map((sec) => (
            <Chip
              key={sec}
              label={formatSeconds(sec)}
              active={state.settings.restSeconds === sec}
              onPress={() => updateSettings({ restSeconds: sec })}
            />
          ))}
        </View>
        <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
          {def.copy.restHint}
        </Text>
      </Card>

    </View>
  );
}

const styles = StyleSheet.create({
  cardGap: { marginTop: 10 },
  rowLabel: { fontSize: 15, fontFamily: font.bodySemi },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  rowHint: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.body,
    marginTop: 12,
  },
});
