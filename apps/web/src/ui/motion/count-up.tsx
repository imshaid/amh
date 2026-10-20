import { animate, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";

import type { NumericValue } from "@/i18n/format";
import { useFormat } from "@/i18n/hooks";

import { COUNT_UP_MS, EASE_OUT } from "./tokens";

/**
 * Counts a figure up to its value when it appears, and from the old value to the new one when it
 * changes. Display only: the frames in between are rounded approximations, and once settled the
 * exact value is shown, formatted from its decimal string (money is never computed here). Screen
 * readers get the exact value straight away.
 */
export function CountUp({
  value,
  kind = "number",
}: {
  value: NumericValue;
  kind?: "money" | "number";
}) {
  const { money, number } = useFormat();
  const format = kind === "money" ? money : number;
  const reducedMotion = useReducedMotion() ?? false;
  const target = Number(value);

  const count = useMotionValue(reducedMotion ? target : 0);
  const text = useTransform(count, (latest) => format(Math.round(latest)));

  // A new value starts a new count; it is settled again once the animation ends.
  const [settledOn, setSettledOn] = useState<number | null>(reducedMotion ? target : null);

  useEffect(() => {
    if (reducedMotion) {
      count.jump(target);
      return;
    }
    const controls = animate(count, target, {
      duration: COUNT_UP_MS / 1000,
      ease: EASE_OUT,
      onComplete: () => {
        setSettledOn(target);
      },
    });
    return () => {
      controls.stop();
    };
  }, [count, target, reducedMotion]);

  const exact = format(value);
  if (reducedMotion || settledOn === target) return <>{exact}</>;
  return (
    <>
      <span className="sr-only">{exact}</span>
      <m.span aria-hidden="true">{text}</m.span>
    </>
  );
}
