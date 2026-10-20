import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "./button";
import type { ButtonProps } from "./button";
import { IconWarning } from "./icons";

/** How long the button waits for the second press before it disarms. */
const ARMED_MS = 3500;

/**
 * A destructive action that asks once, inline: the first press arms it ("Sure? Press again"),
 * the second does it, and it disarms by itself after a few seconds (BLUEPRINT §5.3). No dialog,
 * so the hand does not have to move.
 */
export function ConfirmButton({
  onConfirm,
  confirmLabel,
  children,
  ...props
}: Omit<ButtonProps, "onClick" | "asChild"> & {
  onConfirm: () => void;
  /** The armed label, e.g. "Sure? Press again". */
  confirmLabel: string;
  children: ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => {
      setArmed(false);
    }, ARMED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [armed]);

  return (
    <Button
      variant="danger"
      {...props}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => {
        setArmed(false);
      }}
    >
      {armed ? (
        <>
          <IconWarning aria-hidden="true" />
          {confirmLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
