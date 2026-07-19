import React from "react";
import Svg, { Circle, G, Path } from "react-native-svg";

import { FIGURE_HEIGHT, FIGURE_PATHS } from "@/components/figurePaths";

/**
 * The app mark: a figure holding a push-up inside a progress ring.
 *
 * The figure is the original logo silhouette, traced to vector by
 * scripts/trace-logo.js rather than redrawn — hand-drawn stick-figure versions
 * never matched its anatomy. Only the colours changed.
 */
export const RING = { cx: 48, cy: 48, r: 43 } as const;

/** Arc swept by the accent stroke — a little over a third of the ring. */
export const RING_ARC = "M 48 5 A 43 43 0 0 1 88.4 62";

// Fit the 100-wide silhouette inside the ring and centre it. 0.86 of the inner
// diameter leaves the figure clear of the stroke at its widest.
const INNER_D = 2 * (RING.r - 1.25);
const FIG_SCALE = (0.86 * INNER_D) / 100;
export const FIGURE_TRANSFORM = `translate(${(
  RING.cx -
  (FIG_SCALE * 100) / 2
).toFixed(2)}, ${(RING.cy - (FIG_SCALE * FIGURE_HEIGHT) / 2).toFixed(
  2,
)}) scale(${FIG_SCALE.toFixed(4)})`;

/** The silhouette on its own, without the ring. */
export function PlankFigure({ color }: { color: string }) {
  return (
    <G transform={FIGURE_TRANSFORM}>
      {FIGURE_PATHS.map((d, i) => (
        <Path key={i} d={d} fill={color} />
      ))}
    </G>
  );
}

/** Static app mark. The launch screen animates these same shapes. */
export function PlankMark({
  size = 88,
  ink,
  tint,
  track,
}: {
  size?: number;
  ink: string;
  tint: string;
  track: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle {...RING} stroke={track} strokeWidth={2.5} />
      <Path
        d={RING_ARC}
        stroke={tint}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <PlankFigure color={ink} />
    </Svg>
  );
}
