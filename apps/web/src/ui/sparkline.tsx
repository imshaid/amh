import * as m from "motion/react-m";

import { cn } from "./cn";
import { DATA_DURATION, EASE_OUT } from "./motion/tokens";

/** line: the quiet history; dot: the latest period, ringed in the surface colour; hollow: a running period. */
const TONES = {
  "series-1": {
    line: "stroke-series-1/45",
    dot: "fill-series-1 stroke-surface",
    hollow: "fill-surface stroke-series-1",
  },
  "series-2": {
    line: "stroke-series-2/45",
    dot: "fill-series-2 stroke-surface",
    hollow: "fill-surface stroke-series-2",
  },
  "series-3": {
    line: "stroke-series-3/45",
    dot: "fill-series-3 stroke-surface",
    hollow: "fill-surface stroke-series-3",
  },
  "on-brand": {
    line: "stroke-brand-ink/55",
    dot: "fill-brand-ink stroke-brand",
    hollow: "fill-brand stroke-brand-ink",
  },
} as const;

const WIDTH = 96;
const HEIGHT = 32;
const PAD = 5;

/**
 * A tiny trend line for a stat tile: the history quiet, the latest period as a dot in the accent
 * colour (dataviz stat-tile spec). With `partialLast`, the last period is still running, so its
 * segment is dashed and its dot hollow: never plotted as if it were complete (BLUEPRINT §7).
 * Decorative: the tile's text carries the numbers.
 */
export function Sparkline({
  values,
  tone = "series-1",
  partialLast = false,
  className,
}: {
  values: readonly number[];
  tone?: keyof typeof TONES;
  partialLast?: boolean;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const points = values.map((value, index) => ({
    x: PAD + (index * (WIDTH - 2 * PAD)) / (values.length - 1),
    y: HEIGHT - PAD - ((value - min) / span) * (HEIGHT - 2 * PAD),
  }));
  const toPath = (list: typeof points) =>
    list
      .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join("");
  const complete = partialLast ? points.slice(0, -1) : points;
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const look = TONES[tone];

  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      className={cn("h-8 w-20 shrink-0 overflow-visible", className)}
      aria-hidden="true"
      focusable="false"
    >
      <m.path
        d={toPath(complete)}
        className={cn("fill-none", look.line)}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: DATA_DURATION, ease: EASE_OUT }}
      />
      {partialLast && last && beforeLast ? (
        <path
          d={toPath([beforeLast, last])}
          className={cn("fill-none", look.line)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
      ) : null}
      {last ? (
        <circle
          cx={last.x}
          cy={last.y}
          r={4}
          strokeWidth={2}
          className={partialLast ? look.hollow : look.dot}
        />
      ) : null}
    </svg>
  );
}
