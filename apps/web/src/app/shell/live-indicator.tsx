import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useLiveConnection } from "@/lib/data/live";
import { clientEnv } from "@/lib/env";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/ui/cn";
import { restartAnimation } from "@/ui/motion/restart-animation";

type LiveState = "live" | "checking" | "offline" | "unreachable" | "notConfigured";

const DOT: Record<LiveState, string> = {
  live: "bg-good",
  checking: "bg-line-strong",
  offline: "bg-crit",
  unreachable: "bg-crit",
  notConfigured: "bg-warn",
};

const LABEL: Record<LiveState, string> = {
  live: "text-good-ink",
  checking: "text-muted",
  offline: "text-crit-ink",
  unreachable: "text-crit-ink",
  notConfigured: "text-warn-ink",
};

function useLiveState(): LiveState {
  const online = useOnline();
  const connection = useLiveConnection();
  if (!online) return "offline";
  if (!clientEnv.ok) return "notConfigured";
  if (connection === "live") return "live";
  return connection === "down" ? "unreachable" : "checking";
}

/**
 * Whether this device is receiving changes from the others (BLUEPRINT §2.8): the state of the
 * Realtime channel that brings them (see LiveSync). The dot pulses once
 * when the connection comes up, never in a loop. On phones only the dot shows; screen readers hear
 * the full sentence whenever it changes.
 */
export function LiveIndicator({ className }: { className?: string }) {
  const { t } = useTranslation();
  const state = useLiveState();
  const ring = useRef<HTMLSpanElement>(null);
  const previous = useRef<LiveState | null>(null);

  useEffect(() => {
    if (
      state === "live" &&
      previous.current !== null &&
      previous.current !== "live" &&
      ring.current
    ) {
      restartAnimation(ring.current, "animate-pulse-once");
    }
    previous.current = state;
  }, [state]);

  return (
    <div
      className={cn("flex items-center gap-2 text-sm font-semibold whitespace-nowrap", className)}
      title={t(`live.long.${state}`)}
    >
      <span className="relative grid size-2.5 place-items-center" aria-hidden="true">
        <span ref={ring} className={cn("absolute inset-0 rounded-full opacity-0", DOT[state])} />
        <span className={cn("size-2.5 rounded-full", DOT[state])} />
      </span>
      <span className={cn("max-lg:sr-only", LABEL[state])} aria-hidden="true">
        {t(`live.short.${state}`)}
      </span>
      <span role="status" className="sr-only">
        {t(`live.long.${state}`)}
      </span>
    </div>
  );
}
