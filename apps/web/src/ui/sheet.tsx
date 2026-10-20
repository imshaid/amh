import { AnimatePresence, useDragControls } from "motion/react";
import * as m from "motion/react-m";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "./button";
import { cn } from "./cn";
import { IconClose } from "./icons";
import { DURATION, EASE_OUT } from "./motion/tokens";

/** How far (px) or how fast (px/s) a downward drag must go to close the sheet. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 600;

/**
 * A panel that slides up from the bottom: the phone's way to show a menu, a filter or a large field
 * editor. Drag the handle down, tap outside, press Esc or the close button to dismiss. On wide
 * screens it stays a bottom panel, centred and narrower.
 */
export function Sheet({
  open: controlledOpen,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const dragControls = useDragControls();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.base }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              {...(description ? {} : { "aria-describedby": undefined })}
            >
              <m.div
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col",
                  "rounded-t-3xl border-t border-line bg-surface-raised shadow-raised",
                  "sm:inset-x-auto sm:left-1/2 sm:w-lg sm:-translate-x-1/2 sm:border-x",
                )}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: DURATION.slow, ease: EASE_OUT }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.7 }}
                onDragEnd={(_event, info) => {
                  if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) {
                    setOpen(false);
                  }
                }}
              >
                {/* The grab area: dragging starts here so the body below can still scroll. */}
                <div
                  className="shrink-0 cursor-grab touch-none px-4 pt-2.5 active:cursor-grabbing"
                  onPointerDown={(event) => {
                    dragControls.start(event);
                  }}
                >
                  <div
                    className="mx-auto h-1.5 w-10 rounded-full bg-line-strong"
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-3 pt-2.5 pb-3">
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="type-heading">
                        {title}
                      </DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">
                          {description}
                        </DialogPrimitive.Description>
                      ) : null}
                    </div>
                    <DialogPrimitive.Close asChild>
                      <IconButton
                        label={t("ui.close")}
                        icon={IconClose}
                        variant="ghost"
                        size="sm"
                      />
                    </DialogPrimitive.Close>
                  </div>
                </div>
                {children ? (
                  <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
                    {children}
                  </div>
                ) : null}
                {footer ? (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    {footer}
                  </div>
                ) : (
                  <div className="h-[env(safe-area-inset-bottom)] shrink-0" aria-hidden="true" />
                )}
              </m.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
