import { Toast as ToastPrimitive } from "radix-ui";
import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";

import { cn } from "../cn";
import { IconClose, IconError, IconInfo, IconSuccess, IconWarning } from "../icons";
import type { IconComponent } from "../icons";
import { toast, useToasts } from "./toast-store";
import type { ToastRecord, ToastTone } from "./toast-store";

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 7000;

const TONE: Record<ToastTone, { icon: IconComponent; className: string }> = {
  success: { icon: IconSuccess, className: "text-toast-good" },
  info: { icon: IconInfo, className: "text-toast-info" },
  warning: { icon: IconWarning, className: "text-toast-warn" },
  error: { icon: IconError, className: "text-toast-crit" },
};

function durationOf(record: ToastRecord): number {
  if (record.duration !== undefined) return record.duration;
  // A running job stays until it reports that it has finished.
  if (record.progress && record.progress.done < record.progress.total) return Infinity;
  return record.tone === "error" ? ERROR_DURATION : DEFAULT_DURATION;
}

function ToastItem({ record }: { record: ToastRecord }) {
  const { t } = useTranslation();
  const { number } = useFormat();
  const tone = TONE[record.tone ?? "success"];
  const Icon = tone.icon;
  const progress = record.progress;
  const share = progress && progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <ToastPrimitive.Root
      open={record.open}
      onOpenChange={(open) => {
        if (!open) toast.dismiss(record.id);
      }}
      duration={durationOf(record)}
      // Errors interrupt a screen reader; everything else waits its turn.
      type={record.tone === "error" ? "foreground" : "background"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl bg-toast px-3.5 py-3 text-ui text-toast-ink shadow-raised",
        "data-[state=closed]:animate-toast-out data-[state=open]:animate-toast-in",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-swipe-out data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone.className)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastPrimitive.Title className="font-semibold">{record.title}</ToastPrimitive.Title>
        {record.description ? (
          <ToastPrimitive.Description className="text-sm text-toast-muted">
            {record.description}
          </ToastPrimitive.Description>
        ) : null}
        {progress ? (
          <div className="mt-1.5 flex items-center gap-2.5">
            <div
              role="progressbar"
              aria-label={record.title}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-valuetext={t("ui.progressOf", {
                done: number(progress.done),
                total: number(progress.total),
              })}
              className="h-1 flex-1 overflow-hidden rounded-full bg-toast-ink/15"
            >
              <div
                className="h-full origin-left rounded-full bg-toast-info transition-transform duration-300 ease-out"
                style={{ transform: `scaleX(${String(share)})` }}
              />
            </div>
            <span className="shrink-0 text-xs text-toast-muted tabular">
              {number(progress.done)}/{number(progress.total)}
            </span>
          </div>
        ) : null}
        {record.action ? (
          <ToastPrimitive.Action
            altText={record.action.label}
            className="mt-1.5 self-start rounded-md bg-toast-ink/12 px-2.5 py-1 text-sm font-semibold hover:bg-toast-ink/20"
            onClick={record.action.onAction}
          >
            {record.action.label}
          </ToastPrimitive.Action>
        ) : null}
      </div>
      <ToastPrimitive.Close
        aria-label={t("ui.dismiss")}
        className="-mt-0.5 -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-toast-muted hover:bg-toast-ink/10 hover:text-toast-ink coarse:size-9"
      >
        <IconClose className="size-4" aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * Where toasts appear: bottom right on desktop, above the bottom bar on phones. F8 moves focus to
 * them; swiping right dismisses one.
 */
export function Toaster() {
  const { t } = useTranslation();
  const records = useToasts();
  return (
    <ToastPrimitive.Provider swipeDirection="right" label={t("ui.notifications")}>
      {records.map((record) => (
        <ToastItem key={record.id} record={record} />
      ))}
      <ToastPrimitive.Viewport
        className={cn(
          "fixed right-4 z-60 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-2 outline-none",
          "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-4",
        )}
      />
    </ToastPrimitive.Provider>
  );
}
