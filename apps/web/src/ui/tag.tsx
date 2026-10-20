import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./cn";

const tagVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 text-xs leading-5 font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border border-line bg-surface-2 text-ink-2",
        brand: "bg-brand-soft text-brand-strong",
        turmeric: "bg-turmeric-soft text-turmeric-ink",
        good: "bg-good-soft text-good-ink",
        warn: "bg-warn-soft text-warn-ink",
        serious: "bg-serious-soft text-serious-ink",
        crit: "bg-crit-soft text-crit-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** A small static label: a category, a union, a "same price" warning. */
export function Tag({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span className={cn(tagVariants({ tone }), className)} {...props} />;
}
