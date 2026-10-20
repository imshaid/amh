import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "./cn";
import {
  IconBilled,
  IconCancelled,
  IconConfirmed,
  IconDelivery,
  IconDraft,
  IconPaid,
  IconPartlyPaid,
} from "./icons";
import type { IconComponent } from "./icons";
import type { OrderStatus } from "./order-status";

const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-sm leading-5 font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border border-line bg-surface-2 text-muted",
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

export type PillTone = NonNullable<VariantProps<typeof pillVariants>["tone"]>;

/** A state shown as icon + words; colour is never the only signal (BLUEPRINT §7). */
export function Pill({
  tone,
  icon: Icon,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: PillTone; icon: IconComponent }) {
  return (
    <span className={cn(pillVariants({ tone }), className)} {...props}>
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}

const ORDER_STATUS_LOOK: Record<OrderStatus, { tone: PillTone; icon: IconComponent }> = {
  draft: { tone: "neutral", icon: IconDraft },
  confirmed: { tone: "brand", icon: IconConfirmed },
  delivering: { tone: "turmeric", icon: IconDelivery },
  billed: { tone: "warn", icon: IconBilled },
  partlyPaid: { tone: "warn", icon: IconPartlyPaid },
  paid: { tone: "good", icon: IconPaid },
  cancelled: { tone: "neutral", icon: IconCancelled },
};

/** An order's status (BLUEPRINT §4) with its own colour, icon and words. */
export function OrderStatusPill({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const look = ORDER_STATUS_LOOK[status];
  return (
    <Pill tone={look.tone} icon={look.icon} className={className}>
      {t(`status.order.${status}`)}
    </Pill>
  );
}
