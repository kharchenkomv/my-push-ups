import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { font } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

const DEFAULT_SIZE = 248;
// Thin ring: the number is the subject, the ring is the frame around it.
const STROKE = 6;

export function BigCircle({
  mode,
  value,
  sublabel,
  progress = 0,
  onPress,
  accessibilityLabel,
  color,
  size = DEFAULT_SIZE,
  showProgress,
  valueScale,
}: {
  mode: "work" | "rest";
  value: string;
  sublabel?: string;
  progress?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  color?: string;
  size?: number;
  /**
   * Sweep the ring to show `progress`. Defaults to rest-only, which is what a
   * self-paced rep round wants — but a timed hold needs the sweep while working.
   */
  showProgress?: boolean;
  /**
   * Which glyph size to use. A count is one or two big digits; a duration is
   * four narrower characters that need a stable minimum width.
   */
  valueScale?: "count" | "duration";
}) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const isRest = mode === "rest";
  const sweeps = showProgress ?? isRest;
  const glyphScale = valueScale ?? (isRest ? "duration" : "count");
  const strokeColor = color ?? (isRest ? colors.rest : colors.primary);
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));

  const ring = (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.border}
        strokeWidth={STROKE}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={strokeColor}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${c}`}
        // A self-paced round shows a complete ring — the round is the whole of
        // it. Anything with a running clock sweeps instead.
        strokeDashoffset={sweeps ? offset : 0}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );

  // Both readouts use Inter tabular figures (equal width, equal height, all on
  // the baseline) so digits never look bigger or lower than each other as the
  // value changes — a rep count stepped with +/- jitters just as a countdown does.
  const isDuration = glyphScale === "duration";
  const fontSize = Math.round(size * (isDuration ? 0.235 : 0.35));
  const center = (
    <View style={styles.center} pointerEvents="none">
      <Text
        style={[
          styles.value,
          {
            color: colors.foreground,
            fontSize,
            lineHeight: Math.round(fontSize * 1.2),
            minWidth: isDuration ? size * 0.6 : undefined,
          },
        ]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      {sublabel ? (
        <Text style={[styles.sublabel, { color: colors.mutedForeground }]}>
          {sublabel}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.wrap, { width: size, height: size }]}
        accessibilityLabel={accessibilityLabel}
        testID={isRest ? "rest-ring" : "work-ring"}
      >
        {ring}
        {center}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      testID="work-circle"
    >
      <Animated.View
        style={[
          styles.wrap,
          { width: size, height: size, transform: [{ scale }] },
        ]}
      >
        {ring}
        {center}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
  },
  value: {
    fontFamily: font.bodySemi,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    textAlign: "center",
  },
  sublabel: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 2,
  },
});
