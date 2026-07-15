import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

const SIZE = 240;
const STROKE = 14;

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
      toValue: 0.94,
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
  
  if (mode === "rest") {
    const offset = c * (1 - Math.min(1, Math.max(0, progress)));
    const strokeColor = color || colors.rest;
    return (
      <View
        style={styles.wrap}
        accessibilityLabel={accessibilityLabel}
        testID="rest-ring"
      >
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke="rgba(255,255,255,0.14)"
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
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          {/* The workout screen always sits on a dark gradient, so text must be
              light regardless of the app's light/dark theme. */}
          <Text
            style={[styles.restValue, { color: "#FFFFFF" }]}
            allowFontScaling={false}
          >
            {value}
          </Text>
          {sublabel ? (
            <Text style={[styles.sublabel, { color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 1 }]}>
              {sublabel}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  const offset = c * (1 - Math.min(1, Math.max(0, progress)));
  const strokeColor = color || colors.habit;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={!onPress}
      accessibilityLabel={accessibilityLabel}
      testID="work-circle"
    >
      <Animated.View
        style={[
          styles.wrap,
          { transform: [{ scale }] },
        ]}
      >
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            stroke="rgba(255,255,255,0.14)"
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
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          <Text
            style={[styles.workValue, { color: colors.primaryForeground }]}
            allowFontScaling={false}
          >
            {value}
          </Text>
          {sublabel ? (
            <Text
              style={[
                styles.sublabel,
                { color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 1 },
              ]}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
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
    fontSize: 72,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  restValue: {
    fontSize: 56,
    fontFamily: "SpaceGrotesk_700Bold",
    fontVariant: ["tabular-nums"],
  },
  sublabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 0,
  },
});
