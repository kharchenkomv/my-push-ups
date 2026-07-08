import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

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

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
      {children}
    </Text>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  variant = "primary",
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "ghost-light" | "destructive" | "warning";
  testID?: string;
}) {
  const colors = useColors();
  
  let bg = "transparent";
  let fg = colors.text;
  let shadow = false;
  let borderColor = "transparent";
  let borderWidth = 0;

  if (variant === "primary") {
    bg = colors.primary;
    fg = colors.primaryForeground;
    shadow = true;
  } else if (variant === "secondary") {
    bg = colors.secondary;
    fg = colors.secondaryForeground;
    shadow = true;
  } else if (variant === "destructive") {
    bg = colors.destructive;
    fg = colors.destructiveForeground;
  } else if (variant === "warning") {
    bg = colors.warning;
    fg = colors.primaryForeground;
  } else if (variant === "ghost") {
    fg = colors.mutedForeground;
  } else if (variant === "ghost-light") {
    bg = "rgba(255,255,255,0.1)";
    fg = "#FFFFFF";
    borderColor = "rgba(255,255,255,0.25)";
    borderWidth = 1;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          transform: [{ translateY: pressed && !disabled ? 0 : -1 }],
        },
        shadow && !pressed && !disabled ? styles.shadow : null,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: fg, fontFamily: "SpaceGrotesk_700Bold" }]}>
        {label}
      </Text>
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
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          borderWidth: 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          {
            color: active ? colors.primaryForeground : colors.mutedForeground,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    shadowColor: "#14162B",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 12,
    marginTop: 32,
  },
  button: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 9999,
  },
  buttonLabel: {
    fontSize: 16,
  },
  shadow: {
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
