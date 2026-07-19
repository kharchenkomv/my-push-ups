import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Callout,
  Card,
  Chip,
  PrimaryButton,
  ScreenTitle,
  SectionTitle,
  font,
} from "@/components/UI";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { rescheduleReminders } from "@/lib/notifications";
import { DAY_LABELS, LEVEL_INFO, formatSeconds } from "@/lib/training";
import type { Level, ReminderConfig, Settings } from "@/lib/types";

const GOALS = [20, 30, 50, 100];
const REST_OPTIONS = [30, 45, 60, 90, 120]; // seconds; spec caps rest at 2 min

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    data,
    updateSettings,
    setLevel,
    setHealth,
    resetAll,
    importData,
    exportJson,
  } = useApp();

  const [importVisible, setImportVisible] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");

  if (!data) return null;

  const topPad = Platform.OS === "web" ? 79 : insets.top + 12;
  const s = data.settings;

  const apply = async (patch: Partial<Settings>) => {
    const next = await updateSettings(patch);
    if (next && ("habitReminder" in patch || "habitDaysPerWeek" in patch)) {
      rescheduleReminders(next);
    }
  };

  const changeLevel = (lvl: Level) => {
    if (lvl === data.level) return;
    Alert.alert(
      `Switch to ${LEVEL_INFO[lvl]?.name}?`,
      "You may be asked to take a max test to size your plan.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Switch", onPress: () => setLevel(lvl) },
      ],
    );
  };

  const doExport = async () => {
    try {
      await Share.share({ message: exportJson() });
    } catch {
      // Share cancelled
    }
  };

  const doImport = async () => {
    const ok = await importData(importText.trim());
    if (ok) {
      setImportVisible(false);
      setImportText("");
      Alert.alert("Data restored", "Your backup was imported successfully.");
    } else {
      Alert.alert("Couldn't import", "That doesn't look like a valid backup.");
    }
  };

  const doReset = () => {
    Alert.alert(
      "Reset all data?",
      "This deletes your plan, history, and settings. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetAll },
      ],
    );
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
      <Card>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          Habit days per week
        </Text>
        <View style={styles.chipRow}>
          {[5, 6, 7].map((n) => (
            <Chip
              key={n}
              label={`${n}`}
              active={s.habitDaysPerWeek === n}
              onPress={() => apply({ habitDaysPerWeek: n })}
            />
          ))}
        </View>
        <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
          5 = weekdays, 6 = all but Sunday, 7 = every day.
        </Text>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          Rest between rounds
        </Text>
        <View style={styles.chipRow}>
          {REST_OPTIONS.map((sec) => (
            <Chip
              key={sec}
              label={formatSeconds(sec)}
              active={s.restSeconds === sec}
              onPress={() => apply({ restSeconds: sec })}
            />
          ))}
        </View>
        <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
          Up to 2:00 between the 5 rounds.
        </Text>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          Goal (continuous reps)
        </Text>
        <View style={styles.chipRow}>
          {GOALS.map((g) => (
            <Chip
              key={g}
              label={`${g}`}
              active={s.goalReps === g}
              onPress={() => apply({ goalReps: g })}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.cardGap}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          Level override
        </Text>
        <View style={styles.chipRow}>
          {LEVEL_INFO.map((info, i) => (
            <Chip
              key={info.short}
              label={info.short}
              active={data.level === i}
              onPress={() => changeLevel(i as Level)}
            />
          ))}
        </View>
      </Card>

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
        />
        <ToggleRow
          label="Haptics"
          value={s.haptics}
          onChange={(haptics) => apply({ haptics })}
          last
        />
      </Card>

      <SectionTitle>Health</SectionTitle>
      <Card>
        <ToggleRow
          label="Cardiovascular disease or uncontrolled blood pressure"
          value={data.health.cardio}
          onChange={(cardio) => setHealth({ ...data.health, cardio })}
        />
        <ToggleRow
          label="Major joint or spine problems"
          value={data.health.joints}
          onChange={(joints) => setHealth({ ...data.health, joints })}
        />
        <ToggleRow
          label="Current chest, shoulder, or wrist pain"
          value={data.health.pain}
          onChange={(pain) => setHealth({ ...data.health, pain })}
          last
        />
        {data.health.cardio || data.health.joints || data.health.pain ? (
          <Callout
            icon="alert-triangle"
            tone={colors.warning}
            style={styles.warnGap}
          >
            Consult a physician or qualified health professional before
            continuing this program.
          </Callout>
        ) : null}
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card style={styles.dataCard}>
        <PrimaryButton
          label="Export backup"
          variant="secondary"
          onPress={doExport}
          testID="btn-export"
        />
        <PrimaryButton
          label="Import backup"
          variant="secondary"
          onPress={() => setImportVisible(true)}
          testID="btn-import"
        />
        <PrimaryButton
          label="Reset all data"
          variant="destructive"
          onPress={doReset}
          testID="btn-reset"
        />
      </Card>

      <Text style={[styles.about, { color: colors.mutedForeground }]}>
        My Trainer · fully offline · your data never leaves this device
      </Text>

      <Modal
        visible={importVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setImportVisible(false)}
      >
        <View style={styles.modalWrap}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Import backup
            </Text>
            <Text style={[styles.rowHint, { color: colors.mutedForeground }]}>
              Paste the JSON from a previous export.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder='{"level": 1, ...}'
              placeholderTextColor={colors.mutedForeground}
              testID="input-import"
            />
            <View style={styles.modalBtns}>
              <View style={styles.modalBtn}>
                <PrimaryButton
                  label="Cancel"
                  variant="ghost"
                  onPress={() => setImportVisible(false)}
                />
              </View>
              <View style={styles.modalBtn}>
                <PrimaryButton
                  label="Import"
                  onPress={doImport}
                  disabled={importText.trim().length === 0}
                  testID="btn-do-import"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
