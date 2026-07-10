import { useEventListener } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

const launchVideo = require("@/assets/videos/launch.mp4");

// The video fades to black over its final ~0.6s; start dismissing before that
// so the app is revealed from the title frame, not from black.
const FADE_START_SECONDS = 5.1;
const FADE_DURATION_MS = 350;

export function LaunchAnimation({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const dismissed = useRef(false);

  const player = useVideoPlayer(launchVideo, (p) => {
    p.loop = false;
    p.muted = true;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });

  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(() => onDone());
  };

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    if (currentTime >= FADE_START_SECONDS) dismiss();
  });
  useEventListener(player, "playToEnd", dismiss);
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") dismiss();
  });

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: "#1E3A8A",
  },
});
