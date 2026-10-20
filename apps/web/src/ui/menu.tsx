import { DropdownMenu } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "./cn";
import { IconCheck } from "./icons";

/*
 * A menu that opens from a button: arrow keys move, Enter chooses, Esc closes, and focus returns
 * to the button. Radix's DropdownMenu, styled like the other floating surfaces.
 */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-48 rounded-xl border border-line bg-surface-raised p-1 shadow-raised",
          "origin-(--radix-dropdown-menu-content-transform-origin) data-[state=closed]:animate-popover-out data-[state=open]:animate-popover-in",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted", className)}
      {...props}
    />
  );
}

const itemClasses =
  "relative flex cursor-default items-center gap-2.5 rounded-md py-2 pr-8 pl-2.5 text-ui outline-none select-none coarse:py-3 data-highlighted:bg-brand-soft data-highlighted:text-brand-strong data-disabled:opacity-45 [&_svg]:size-4.5 [&_svg]:shrink-0";

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className={cn(itemClasses, className)} {...props} />;
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClasses, className)} {...props}>
      {children}
      <DropdownMenu.ItemIndicator className="absolute right-2.5">
        <IconCheck className="size-4" aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
