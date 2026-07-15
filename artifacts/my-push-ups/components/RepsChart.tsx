import React, { useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { keyToDate } from "@/lib/training";

export interface RepsPoint {
  date: string;
  total: number;
}

const HEIGHT = 190;
const PAD_T = 16;
const PAD_B = 30;
const PAD_L = 36;
const PAD_R = 14;

// Round a value up to a "nice" axis maximum (5, 10, 20, 50, 100, …).
function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function fmtDate(d: string): string {
  return keyToDate(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Line/area chart of total push-ups per day against the calendar date.
export function RepsChart({ points }: { points: RepsPoint[] }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);

  const series = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = HEIGHT - PAD_T - PAD_B;
  const baseY = PAD_T + plotH;

  const maxY = niceCeil(Math.max(...series.map((p) => p.total), 1));

  const t0 = keyToDate(series[0]?.date ?? "2026-01-01").getTime();
  const tN = keyToDate(series[series.length - 1]?.date ?? "2026-01-01").getTime();
  const span = Math.max(1, tN - t0);
  const single = series.length === 1;

  const xOf = (d: string) =>
    single
      ? PAD_L + plotW / 2
      : PAD_L + ((keyToDate(d).getTime() - t0) / span) * plotW;
  const yOf = (v: number) => PAD_T + plotH * (1 - v / maxY);

  const pts = series.map((p) => ({ ...p, x: xOf(p.date), y: yOf(p.total) }));
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    pts.length > 1
      ? `${linePath} L${pts[pts.length - 1]!.x.toFixed(1)},${baseY} L${pts[0]!.x.toFixed(1)},${baseY} Z`
      : "";

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="repsFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* top gridline (maxY) and baseline (0) */}
          <Line
            x1={PAD_L}
            y1={PAD_T}
            x2={width - PAD_R}
            y2={PAD_T}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
          <Line
            x1={PAD_L}
            y1={baseY}
            x2={width - PAD_R}
            y2={baseY}
            stroke={colors.border}
            strokeWidth={1}
          />

          {areaPath ? <Path d={areaPath} fill="url(#repsFill)" /> : null}
          {pts.length > 1 ? (
            <Path
              d={linePath}
              stroke={colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={pts.length > 18 ? 2.5 : 4}
              fill={colors.primary}
              stroke={colors.card}
              strokeWidth={1.5}
            />
          ))}

          {/* y-axis labels */}
          <SvgText
            x={PAD_L - 8}
            y={PAD_T + 4}
            fontSize={11}
            fontFamily="Inter_600SemiBold"
            fill={colors.mutedForeground}
            textAnchor="end"
          >
            {maxY}
          </SvgText>
          <SvgText
            x={PAD_L - 8}
            y={baseY + 4}
            fontSize={11}
            fontFamily="Inter_600SemiBold"
            fill={colors.mutedForeground}
            textAnchor="end"
          >
            0
          </SvgText>

          {/* x-axis labels: first and last date */}
          <SvgText
            x={pts[0]!.x}
            y={HEIGHT - 8}
            fontSize={11}
            fontFamily="Inter_600SemiBold"
            fill={colors.mutedForeground}
            textAnchor={single ? "middle" : "start"}
          >
            {fmtDate(series[0]!.date)}
          </SvgText>
          {pts.length > 1 ? (
            <SvgText
              x={pts[pts.length - 1]!.x}
              y={HEIGHT - 8}
              fontSize={11}
              fontFamily="Inter_600SemiBold"
              fill={colors.mutedForeground}
              textAnchor="end"
            >
              {fmtDate(series[series.length - 1]!.date)}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
