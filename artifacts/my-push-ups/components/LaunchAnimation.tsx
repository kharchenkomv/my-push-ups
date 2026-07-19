import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { PlankFigure, RING, RING_ARC } from "@/components/PlankMark";

// Builds the app mark rather than showing it: the ring settles, the accent arc
// sweeps round like a set being completed, the figure rises into place, then the
// wordmark. Same lockup as the static mark on the welcome screen.
//
// The figure is a filled silhouette, so it cannot be "drawn on" with a dash
// offset the way the arc is — it fades and rises instead.

const MARK_SIZE = 116;

const RING_DURATION_MS = 520;

const ARC_DELAY_MS = 260;
const ARC_DURATION_MS = 720;

const FIG_DELAY_MS = 620;
const FIG_DURATION_MS = 500;

const TEXT_DELAY_MS = 1060;
const TEXT_DURATION_MS = 460;

const HOLD_UNTIL_MS = TEXT_DELAY_MS + TEXT_DURATION_MS + 320;
const EXIT_DURATION_MS = 300;

// Length of the arc stroke in viewBox units, used to draw it on.
const ARC_LEN = 84;

// Fixed brand colors, not theme-dependent, so this matches the native splash
// screen exactly and there is no flash as it hands off.
const BASE = "#fbf9f2";
const INK = "#3b3330";
const TINT = "#a4542f";
const TRACK = "#e8e0cd";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function LaunchAnimation({ onDone }: { onDone: () => void }) {
  const overlayOpacity = useSharedValue(1);
  const ring = useSharedValue(0);
  const arc = useSharedValue(0);
  const fig = useSharedValue(0);
  const text = useSharedValue(0);

  useEffect(() => {
    ring.value = withTiming(1, {
      duration: RING_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    arc.value = withDelay(
      ARC_DELAY_MS,
      withTiming(1, {
        duration: ARC_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    fig.value = withDelay(
      FIG_DELAY_MS,
      withTiming(1, {
        duration: FIG_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    text.value = withDelay(
      TEXT_DELAY_MS,
      withTiming(1, {
        duration: TEXT_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    overlayOpacity.value = withDelay(
      HOLD_UNTIL_MS,
      withTiming(
        0,
        { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
    );
    // Runs once on mount; the overlay is remounted for each launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: 0.92 + ring.value * 0.08 }],
  }));

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LEN * (1 - arc.value),
  }));

  const figStyle = useAnimatedStyle(() => ({
    opacity: fig.value,
    transform: [{ translateY: (1 - fig.value) * 8 }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: (1 - text.value) * 10 }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <Animated.View style={[styles.mark, markStyle]}>
        <Svg
          width={MARK_SIZE}
          height={MARK_SIZE}
          viewBox="0 0 96 96"
          fill="none"
        >
          <Circle {...RING} stroke={TRACK} strokeWidth={2.5} />
          <AnimatedPath
            d={RING_ARC}
            stroke={TINT}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={ARC_LEN}
            animatedProps={arcProps}
          />
        </Svg>

        {/* Figure layered over the ring so it can animate independently. */}
        <Animated.View style={[StyleSheet.absoluteFill, figStyle]}>
          <Svg
            width={MARK_SIZE}
            height={MARK_SIZE}
            viewBox="0 0 96 96"
            fill="none"
          >
            <PlankFigure color={INK} />
          </Svg>
        </Animated.View>
      </Animated.View>

      <Animated.Text style={[styles.wordmark, textStyle]}>
        My Trainer
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BASE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  wordmark: {
    marginTop: 22,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 32,
    letterSpacing: 0.3,
    color: INK,
  },
});
