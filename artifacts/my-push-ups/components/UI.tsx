import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

// Typography roles. Display is the bookish serif used for headings and any
// number the eye should land on; the rest is Inter.
export const font = {
  display: "PlayfairDisplay_600SemiBold",
  displayLight: "PlayfairDisplay_500Medium",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

/** Flat surface with a hairline rule. No shadow — depth comes from spacing. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Large serif screen title, set like the opening line of a chapter. */
export function ScreenTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.screenTitleWrap}>
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>
        {children}
      </Text>
      {subtitle ? (
        <Text style={[styles.screenSubtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
      {children}
    </Text>
  );
}

/** Small uppercase eyebrow. The movement's quiet label voice. */
export function Kicker({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const colors = useColors();
  return (
    <Text style={[styles.kicker, { color: color ?? colors.mutedForeground }]}>
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  variant = "primary",
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: FeatherName;
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "outline"
    | "destructive"
    | "warning";
  testID?: string;
}) {
  const colors = useColors();

  const palette =
    variant === "primary"
      ? {
          bg: colors.primary,
          fg: colors.primaryForeground,
          border: colors.primary,
        }
      : variant === "destructive"
        ? {
            bg: colors.destructive,
            fg: colors.destructiveForeground,
            border: colors.destructive,
          }
        : variant === "warning"
          ? {
              bg: colors.warning,
              fg: colors.primaryForeground,
              border: colors.warning,
            }
          : variant === "secondary"
            ? {
                bg: colors.secondary,
                fg: colors.secondaryForeground,
                border: colors.border,
              }
            : variant === "outline"
              ? {
                  bg: "transparent",
                  fg: colors.foreground,
                  border: colors.border,
                }
              : { bg: "transparent", fg: colors.mutedForeground, border: "transparent" };

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
    }
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: colors.radius,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={palette.fg} /> : null}
      <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onPress();
  };
  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          borderRadius: colors.radius - 4,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Compact metric tile: uppercase label, serif value. */
export function StatCard({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string | number;
  caption?: string;
  accent?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text
        style={[styles.statLabel, { color: colors.mutedForeground }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[styles.statValue, { color: accent ?? colors.foreground }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {caption ? (
        <Text style={[styles.statCaption, { color: colors.mutedForeground }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Quiet inline note. `tone` tints the icon and rule, never the whole block. */
export function Callout({
  icon,
  children,
  tone,
  style,
}: {
  icon?: FeatherName;
  children: React.ReactNode;
  tone?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const tint = tone ?? colors.mutedForeground;
  return (
    <View
      style={[
        styles.callout,
        {
          backgroundColor: colors.muted,
          borderRadius: colors.radius,
          borderLeftColor: tint,
        },
        style,
      ]}
    >
      {icon ? (
        <Feather name={icon} size={16} color={tint} style={styles.calloutIcon} />
      ) : null}
      <Text style={[styles.calloutText, { color: colors.mutedForeground }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },

  screenTitleWrap: {
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: font.display,
    letterSpacing: 0.2,
  },
  screenSubtitle: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontFamily: font.display,
    marginBottom: 12,
    marginTop: 32,
  },
  kicker: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  button: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonLabel: {
    fontSize: 15,
    fontFamily: font.bodySemi,
    letterSpacing: 0.2,
  },

  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: font.bodyMedium,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: font.bodyMedium,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: font.display,
  },
  statCaption: {
    fontSize: 12,
    fontFamily: font.body,
  },

  callout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderLeftWidth: 2,
  },
  calloutIcon: {
    marginTop: 2,
  },
  calloutText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: font.body,
  },
});
