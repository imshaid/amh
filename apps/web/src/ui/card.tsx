import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";

/*
 * Cards are applied by role, not by default (BLUEPRINT §7): a panel that groups one subject
 * (a chart, a list, a form) gets a card; page headers, toolbars and notes do not.
 */
const cardVariants = cva("min-w-0 rounded-xl", {
  variants: {
    variant: {
      /** The default panel: surface with a hairline edge. */
      panel: "border border-line bg-surface",
      /** The one figure a screen leads with, on the brand colour. */
      hero: "border border-brand bg-brand text-brand-ink",
      /** A quieter group inside a panel or on the page. */
      inset: "bg-surface-2",
      /** A card that is itself a link or button: lifts and outlines on hover. */
      interactive:
        "border border-line bg-surface transition-[border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong",
    },
    padding: {
      none: "",
      sm: "p-3",
      md: "p-4 sm:p-4.5",
    },
  },
  defaultVariants: { variant: "panel", padding: "md" },
});

export function Card({
  className,
  variant,
  padding,
  ...props
}: ComponentProps<"section"> & VariantProps<typeof cardVariants>) {
  return <section className={cn(cardVariants({ variant, padding }), className)} {...props} />;
}

/** A card's title row: heading and subtitle on the left, actions on the right. */
export function CardHeader({
  title,
  subtitle,
  actions,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading className={Heading === "h2" ? "type-heading" : "type-subheading"}>{title}</Heading>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
