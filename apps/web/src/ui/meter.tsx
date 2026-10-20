import * as m from "motion/react-m";

import { cn } from "./cn";
import { DATA_DURATION, EASE_OUT } from "./motion/tokens";

const TONES = {
  brand: { track: "bg-brand-soft", fill: "bg-brand" },
  turmeric: { track: "bg-turmeric-soft", fill: "bg-turmeric" },
  good: { track: "bg-good-soft", fill: "bg-good" },
  warn: { track: "bg-warn-soft", fill: "bg-warn" },
  crit: { track: "bg-crit-soft", fill: "bg-crit" },
  "on-brand": { track: "bg-brand-ink/25", fill: "bg-brand-ink" },
} as const;

export type MeterTone = keyof typeof TONES;

/**
 * How far along something is (challans delivered, signed copies back). The track is a light step
 * of the fill's own colour, so the whole bar reads as one state. Fills from the left on mount and
 * when the value changes.
 */
export function Meter({
  value,
  max,
  label,
  valueText,
  tone = "brand",
  size = "md",
  className,
}: {
  value: number;
  max: number;
  /** Names the meter for screen readers when no visible label is attached. */
  label: string;
  /** How a screen reader reads the value, e.g. "7 of 12 delivered". */
  valueText: string;
  tone?: MeterTone;
  size?: "sm" | "md";
  className?: string;
}) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn(
        "w-full overflow-hidden rounded-full",
        size === "md" ? "h-1.5" : "h-1",
        TONES[tone].track,
        className,
      )}
    >
      <m.div
        className={cn("h-full rounded-full", TONES[tone].fill)}
        initial={{ width: "0%" }}
        animate={{ width: `${String(share * 100)}%` }}
        transition={{ duration: DATA_DURATION, ease: EASE_OUT }}
      />
    </div>
  );
}
