import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";

import { cn } from "./cn";
import { IconCheck } from "./icons";

type StepState = "done" | "current" | "upcoming";

function stepState(index: number, current: number): StepState {
  if (index < current) return "done";
  return index === current ? "current" : "upcoming";
}

/**
 * Where something is along a fixed path, e.g. an order's Order → Delivery → Bill → Payment.
 * `current` is the index of the step in progress; steps.length means everything is done. In a
 * narrow space (a phone, a side panel) labels sit under the circles so the row never wraps.
 */
export function ProgressSteps({
  steps,
  current,
  label,
  className,
}: {
  steps: readonly { id: string; label: string }[];
  current: number;
  label: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { number } = useFormat();
  return (
    <div className={cn("@container", className)}>
      <ol aria-label={label} className="flex items-start @sm:items-center">
        {steps.map((step, index) => {
          const state = stepState(index, current);
          return (
            <Fragment key={step.id}>
              {index > 0 ? (
                <li
                  aria-hidden="true"
                  className={cn(
                    "mx-1 mt-2.5 h-0.5 min-w-3 flex-1 rounded-full @sm:mx-2 @sm:mt-0 @sm:w-8 @sm:flex-none",
                    index <= current ? "bg-brand" : "bg-line-strong",
                  )}
                />
              ) : null}
              <li
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 text-xs font-medium @sm:flex-row @sm:gap-1.5 @sm:text-sm",
                  state === "done" && "text-ink-2",
                  state === "current" && "text-turmeric-ink",
                  state === "upcoming" && "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-5.5 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold tabular",
                    state === "done" && "border-brand bg-brand text-brand-ink",
                    state === "current" && "border-turmeric bg-turmeric-soft text-turmeric-ink",
                    state === "upcoming" && "border-line-strong bg-surface text-muted",
                  )}
                  aria-hidden="true"
                >
                  {state === "done" ? (
                    <IconCheck className="size-3.5" strokeWidth={3} />
                  ) : (
                    number(index + 1)
                  )}
                </span>
                {step.label}
                <span className="sr-only">{t(`ui.steps.${state}`)}</span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
