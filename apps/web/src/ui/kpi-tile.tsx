import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { NumericValue } from "@/i18n/format";
import { useFormat } from "@/i18n/hooks";

import { Card } from "./card";
import { cn } from "./cn";
import { IconTrendDown, IconTrendFlat, IconTrendUp } from "./icons";
import type { IconComponent } from "./icons";
import { CountUp } from "./motion/count-up";

export interface KpiDelta {
  /** Percentage change as a decimal string from the server, without sign, e.g. "13.5". */
  percent: NumericValue;
  direction: "up" | "down" | "flat";
  /** Whether this direction is good news (more money received is; more days to pay is not). */
  favourable: boolean;
  /** What it is compared with, e.g. "vs August". */
  comparison: string;
}

const DELTA_ICON: Record<KpiDelta["direction"], IconComponent> = {
  up: IconTrendUp,
  down: IconTrendDown,
  flat: IconTrendFlat,
};

/**
 * One headline number with its context (dataviz stat-tile contract): a label, the value counting
 * up, an optional change against a named period, a trend, and a line of detail. The `hero` tile is
 * the one figure a dashboard leads with; use it once per screen.
 */
export function KpiTile({
  label,
  icon: Icon,
  value,
  kind = "money",
  suffix,
  delta,
  trend,
  meta,
  hero = false,
  className,
}: {
  label: string;
  icon?: IconComponent;
  value: NumericValue;
  kind?: "money" | "number";
  /** Smaller text after the value, e.g. "/ 66" for a count against a total. */
  suffix?: ReactNode;
  delta?: KpiDelta;
  /** A sparkline or a meter, placed beside or under the value. */
  trend?: ReactNode;
  meta?: ReactNode;
  hero?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { number } = useFormat();
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null;

  return (
    <Card variant={hero ? "hero" : "panel"} className={cn("flex flex-col gap-1.5", className)}>
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          hero ? "text-brand-ink/85" : "text-ink-2",
        )}
      >
        {Icon ? <Icon className="size-4.5 shrink-0" aria-hidden="true" /> : null}
        {label}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-2">
        <p className={hero ? "type-hero" : "type-figure"}>
          <CountUp value={value} kind={kind} />
          {suffix ? (
            <span className={cn("ml-1 text-lg", hero ? "text-brand-ink/75" : "text-muted")}>
              {suffix}
            </span>
          ) : null}
        </p>
        {trend}
      </div>
      {delta || meta ? (
        <p
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm",
            hero ? "text-brand-ink/85" : "text-muted",
          )}
        >
          {delta && DeltaIcon ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 text-xs leading-5 font-semibold",
                delta.direction === "flat"
                  ? "bg-surface-2 text-ink-2"
                  : delta.favourable
                    ? "bg-good-soft text-good-ink"
                    : "bg-crit-soft text-crit-ink",
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">{t(`ui.delta.${delta.direction}`)}</span>
              {t("ui.percent", { value: number(delta.percent, 1) })}
            </span>
          ) : null}
          {delta ? <span>{delta.comparison}</span> : null}
          {delta && meta ? <span aria-hidden="true">·</span> : null}
          {meta}
        </p>
      ) : null}
    </Card>
  );
}
