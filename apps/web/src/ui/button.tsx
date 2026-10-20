import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "./cn";
import { IconSpinner } from "./icons";
import type { IconComponent } from "./icons";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 border font-semibold whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The one main action of a screen or dialog. */
        primary:
          "border-brand bg-brand text-brand-ink hover:border-brand-strong hover:bg-brand-strong",
        /** Everything else that is clearly a button. */
        secondary:
          "border-line-strong bg-surface text-ink hover:border-brand hover:text-brand-strong",
        /** Low-emphasis actions inside toolbars, menus and dense rows. */
        ghost: "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
        /** Deleting or cancelling something that matters; pair with a second-press confirm. */
        danger: "border-crit/45 bg-surface text-crit-ink hover:border-crit hover:bg-crit-soft",
      },
      size: {
        sm: "h-8 rounded-md px-2.5 text-sm coarse:min-h-10 [&_svg]:size-4",
        md: "h-10 rounded-lg px-3.5 text-ui coarse:min-h-11 [&_svg]:size-4.5",
        lg: "h-12 rounded-xl px-5 text-base [&_svg]:size-5",
        icon: "size-10 rounded-lg coarse:size-11 [&_svg]:size-4.5",
        "icon-sm": "size-8 rounded-md coarse:size-10 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the child element (e.g. a router Link) with the button's look. */
    asChild?: boolean;
    /** Shows a spinner, keeps the width, and blocks further presses until the work is done. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <IconSpinner className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "size" | "children" | "asChild"> & {
  /** What the button does, read by screen readers and shown as a tooltip. */
  label: string;
  icon: IconComponent;
  size?: "md" | "sm";
};

/** A square button with only an icon; `label` names it for everyone who cannot see the icon. */
export function IconButton({ label, icon: Icon, size = "md", ...props }: IconButtonProps) {
  return (
    <Button size={size === "md" ? "icon" : "icon-sm"} aria-label={label} title={label} {...props}>
      <Icon />
    </Button>
  );
}
