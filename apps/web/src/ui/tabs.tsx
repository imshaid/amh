import * as m from "motion/react-m";
import { Tabs as TabsPrimitive } from "radix-ui";
import { createContext, useContext, useId, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "./cn";
import type { IconComponent } from "./icons";
import { DURATION, EASE_OUT } from "./motion/tokens";

interface TabsContextValue {
  value: string;
  indicatorId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * Tabs whose underline slides to the chosen tab. Arrow keys move between tabs (Radix). Controlled
 * with `value`/`onValueChange`, or uncontrolled with `defaultValue`.
 */
export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolledValue;
  const indicatorId = useId();
  return (
    <TabsContext value={{ value, indicatorId }}>
      <TabsPrimitive.Root
        value={value}
        onValueChange={(next) => {
          setUncontrolledValue(next);
          onValueChange?.(next);
        }}
        className={cn("flex min-w-0 flex-col", className)}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext>
  );
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "relative flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-line",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  icon: Icon,
  badge,
  className,
  children,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger> & {
  icon?: IconComponent;
  /** A count or short marker after the label, e.g. the number of challans. */
  badge?: ReactNode;
}) {
  const context = useContext(TabsContext);
  const indicatorId = context?.value === value ? context.indicatorId : null;
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative flex h-11 shrink-0 items-center gap-2 rounded-t-md px-3 text-ui font-semibold whitespace-nowrap text-muted",
        "transition-colors duration-150 hover:text-ink data-[state=active]:text-ink",
        "focus-visible:-outline-offset-2",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4.5" aria-hidden="true" /> : null}
      {children}
      {badge === undefined ? null : (
        <span className="rounded-full bg-surface-2 px-1.5 text-xs leading-5 text-ink-2 tabular">
          {badge}
        </span>
      )}
      {indicatorId ? (
        <m.span
          layoutId={indicatorId}
          className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-brand"
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
          aria-hidden="true"
        />
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("animate-rise pt-4 focus-visible:outline-offset-4", className)}
      {...props}
    />
  );
}
