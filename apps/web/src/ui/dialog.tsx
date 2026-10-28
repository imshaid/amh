import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "./button";
import { cn } from "./cn";
import { IconClose } from "./icons";

export const DialogClose = DialogPrimitive.Close;

/**
 * A centred modal for a focused decision (confirm, a short form). Focus is trapped inside, Esc and
 * the close button dismiss it, and focus returns to what opened it. On phones, prefer a Sheet for
 * anything longer than a few fields.
 */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  size = "md",
  onOpenAutoFocus,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element that opens the dialog (rendered as is, e.g. a Button). */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Actions, primary last. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Where focus starts; by default the first focusable element (the close button). */
  onOpenAutoFocus?: (event: Event) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          {...(onOpenAutoFocus ? { onOpenAutoFocus } : {})}
          // Without a description, say so explicitly; with one, Radix links it itself.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-[12dvh] left-1/2 z-50 flex max-h-[80dvh] w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden",
            "rounded-2xl border border-line bg-surface-raised shadow-raised",
            "data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in",
            { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl" }[size],
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="type-heading">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label={t("ui.close")} icon={IconClose} variant="ghost" size="sm" />
            </DialogPrimitive.Close>
          </div>
          {children ? <div className="min-h-0 overflow-y-auto px-4 py-4">{children}</div> : null}
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-4 py-3">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
