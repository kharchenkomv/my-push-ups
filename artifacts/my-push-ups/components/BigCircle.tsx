import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { font } from "@/components/UI";
import { useColors } from "@/hooks/useColors";

const SIZE = 248;
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
}: {
  mode: "work" | "rest";
  value: string;
  sublabel?: string;
  progress?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  color?: string;
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

  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const isRest = mode === "rest";
  const strokeColor = color ?? (isRest ? colors.rest : colors.primary);
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));

  const ring = (
    <Svg width={SIZE} height={SIZE}>
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={r}
        stroke={colors.border}
        strokeWidth={STROKE}
        fill="none"
      />
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={r}
        stroke={strokeColor}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${c}`}
        // Work mode shows a complete ring — the round is the whole of it.
        strokeDashoffset={isRest ? offset : 0}
        strokeLinecap="round"
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </Svg>
  );

  const center = (
    <View style={styles.center}>
      <Text
        style={[
          isRest ? styles.restValue : styles.workValue,
          { color: colors.foreground },
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

  if (isRest) {
    return (
      <View
        style={styles.wrap}
        accessibilityLabel={accessibilityLabel}
        testID="rest-ring"
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
      disabled={!onPress}
      accessibilityLabel={accessibilityLabel}
      testID="work-circle"
    >
      <Animated.View style={[styles.wrap, { transform: [{ scale }] }]}>
        {ring}
        {center}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    alignItems: "center",
  },
  workValue: {
    fontSize: 88,
    lineHeight: 100,
    fontFamily: font.display,
  },
  restValue: {
    fontSize: 60,
    lineHeight: 70,
    fontFamily: font.display,
    // Serif digits are proportional; a fixed box stops the countdown jittering.
    width: 170,
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
