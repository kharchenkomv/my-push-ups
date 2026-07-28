import { Feather } from "@expo/vector-icons";
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

import {
  Card,
  Chip,
  PrimaryButton,
  ScreenTitle,
  SectionTitle,
  font,
} from "@/components/UI";
import { ExerciseSettingsCard } from "@/components/exercise/ExerciseSettingsCard";
import { useApp } from "@/context/AppContext";
import { useEnabledExercises } from "@/context/useExercise";
import { useColors } from "@/hooks/useColors";
import { exportBackupFile, pickBackupFile } from "@/lib/backup";
import { DAY_LABELS } from "@/lib/core";
import { confirmAction, notify } from "@/lib/dialogs";
import { rescheduleReminders } from "@/lib/notifications";
import type { ReminderConfig, Settings } from "@/lib/types";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, updateSettings, resetAll, importData, exportJson } = useApp();
  const views = useEnabledExercises();

  const [busy, setBusy] = useState<boolean>(false);

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const s = data.settings;

  const apply = async (patch: Partial<Settings>) => {
    const next = await updateSettings(patch);
    if (next && "habitReminder" in patch) {
      rescheduleReminders(next, views.map((v) => v.def));
    }
  };

  const doExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportBackupFile(exportJson());
    } catch {
      notify("Couldn't export", "The backup file could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const contents = await pickBackupFile();
      if (contents === null) return; // cancelled
      const ok = await importData(contents);
      if (ok) {
        notify("Data restored", "Your backup was imported successfully.");
      } else {
        notify("Couldn't import", "That file doesn't look like a valid backup.");
      }
    } catch {
      notify("Couldn't import", "That file could not be read.");
    } finally {
      setBusy(false);
    }
  };

  const doReset = () => {
    confirmAction({
      title: "Reset all data?",
      message:
        "This deletes your plan, history, and settings. This can't be undone.",
      confirmLabel: "Reset",
      destructive: true,
      onConfirm: () => {
        void resetAll();
      },
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: 130 },
      ]}
    >
      <ScreenTitle subtitle="Tune your plan">Settings</ScreenTitle>

      <SectionTitle>Training</SectionTitle>
      <View style={styles.exerciseStack}>
        {views.map((v) => (
          <ExerciseSettingsCard key={v.id} view={v} showsName={views.length > 1} />
        ))}
      </View>

      <SectionTitle>Reminders</SectionTitle>
      <ReminderCard
        title="Habit reminder"
        config={s.habitReminder}
        onChange={(habitReminder) => apply({ habitReminder })}
      />
      {Platform.OS === "web" ? (
        <Text style={[styles.rowHint, { color: colors.mutedForeground, marginTop: 8 }]}>
          Reminders work on your phone, not in the browser preview.
        </Text>
      ) : null}

      <SectionTitle>Feedback</SectionTitle>
      <Card>
        <ToggleRow
          label="Sound"
          value={s.sound}
          onChange={(sound) => apply({ sound })}
          last
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card style={styles.dataCard}>
        <PrimaryButton
          label="Export backup"
          variant="secondary"
          onPress={doExport}
          disabled={busy}
          testID="btn-export"
        />
        <PrimaryButton
          label="Import backup"
          variant="secondary"
          onPress={doImport}
          disabled={busy}
          testID="btn-import"
        />
        <PrimaryButton
          label="Reset all data"
          variant="destructive"
          onPress={doReset}
          testID="btn-reset"
        />
        <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
          Backups are plain .json files. Export saves one; import replaces
          everything on this device with the file you pick.
        </Text>
      </Card>

      <Text style={[styles.about, { color: colors.mutedForeground }]}>
        My Trainer · fully offline · your data never leaves this device
      </Text>

    </ScrollView>
  );
}

function RoundBtn({
  icon,
  onPress,
}: {
  icon: "plus" | "minus";
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundBtn,
        { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.toggleRow,
        !last
          ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
          : null,
      ]}
    >
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.muted }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ReminderCard({
  title,
  config,
  onChange,
}: {
  title: string;
  config: ReminderConfig;
  onChange: (c: ReminderConfig) => void;
}) {
  const colors = useColors();
  const timeLabel = `${`${config.hour}`.padStart(2, "0")}:${`${config.minute}`.padStart(2, "0")}`;

  const shiftTime = (mins: number) => {
    let total = config.hour * 60 + config.minute + mins;
    total = ((total % 1440) + 1440) % 1440;
    onChange({
      ...config,
      hour: Math.floor(total / 60),
      minute: total % 60,
    });
  };

  return (
    <Card style={styles.cardGap}>
      <View style={styles.reminderHead}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {title}
        </Text>
        <Switch
          value={config.enabled}
          onValueChange={(enabled) => onChange({ ...config, enabled })}
          trackColor={{ true: colors.primary, false: colors.muted }}
          thumbColor="#FFFFFF"
        />
      </View>
      {config.enabled ? (
        <>
          <View style={styles.stepRow}>
            <RoundBtn icon="minus" onPress={() => shiftTime(-30)} />
            <Text style={[styles.stepValue, { color: colors.foreground }]}>
              {timeLabel}
            </Text>
            <RoundBtn icon="plus" onPress={() => shiftTime(30)} />
          </View>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <Chip
                key={wd}
                label={DAY_LABELS[wd] ?? ""}
                active={config.days.includes(wd)}
                onPress={() => {
                  const has = config.days.includes(wd);
                  if (has && config.days.length <= 1) return;
                  const days = has
                    ? config.days.filter((d) => d !== wd)
                    : [...config.days, wd].sort((a, b) => a - b);
                  onChange({ ...config, days });
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  exerciseStack: { gap: 10 },
  rowLabel: { fontSize: 15, fontFamily: font.bodySemi },
  rowHint: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.body,
    marginTop: 12,
  },
  cardGap: { marginTop: 16 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 16,
  },
  stepValue: {
    fontSize: 34,
    lineHeight: 42,
    fontFamily: font.display,
    minWidth: 110,
    textAlign: "center",
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: font.body,
    lineHeight: 20,
  },
  warnGap: { marginTop: 16 },
  dataCard: { gap: 12 },
  about: {
    fontSize: 12,
    fontFamily: font.body,
    textAlign: "center",
    marginTop: 40,
    lineHeight: 18,
  },
  reminderHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(59,51,48,0.45)",
  },
  modalCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: font.display,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    height: 180,
    marginTop: 16,
    fontSize: 14,
    fontFamily: font.body,
    textAlignVertical: "top",
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 24 },
  modalBtn: { flex: 1 },
});
