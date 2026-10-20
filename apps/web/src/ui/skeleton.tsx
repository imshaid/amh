import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "./cn";

/**
 * A placeholder block with a soft shimmer, shown while content loads. Skeletons replace spinners
 * (BLUEPRINT §7); with reduced motion the shimmer stands still.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--line)_45%,var(--surface-2)_90%)] bg-size-[200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/** Lines of text loading; the last line is shorter, like a paragraph's. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn("h-3.5", index === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

/** What a screen looks like while its first data loads: header, figures, a main panel. */
export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5" role="status" aria-live="polite">
      <span className="sr-only">{t("ui.loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
