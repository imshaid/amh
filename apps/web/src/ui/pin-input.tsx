import { useState } from "react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import { toLatinDigits } from "@/i18n/format";

import { IconButton } from "./button";
import { cn } from "./cn";
import { useFieldProps } from "./field-control";
import { IconHide, IconShow } from "./icons";

/**
 * A PIN entered as digits in boxes, like a mobile-banking PIN. One real input lies over the boxes,
 * so screen readers, password managers, paste and the phone's number pad all work; the boxes only
 * show progress. Bangla digits are accepted. Put it inside a Field for its label.
 */
export function PinInput({
  value,
  onValueChange,
  onComplete,
  length = 6,
  autoComplete = "current-password",
  autoFocus,
  disabled,
  name,
  ref,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Called once when the last digit is typed. */
  onComplete?: (value: string) => void;
  length?: number;
  autoComplete?: "current-password" | "new-password" | "off";
  autoFocus?: boolean;
  disabled?: boolean;
  name?: string;
  ref?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const { t } = useTranslation();
  const fieldProps = useFieldProps({});
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const active = Math.min(value.length, length - 1);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div className="flex gap-1.5 sm:gap-2" aria-hidden="true">
          {Array.from({ length }, (_, index) => {
            const digit = value.charAt(index);
            return (
              <span
                key={index}
                className={cn(
                  "grid h-13 w-10 place-items-center rounded-lg border bg-surface font-display text-2xl font-semibold tabular-nums transition-[border-color,box-shadow] duration-150 sm:w-11",
                  digit ? "border-ink-2/60 text-ink" : "border-field text-muted",
                  focused && index === active && "border-brand ring-2 ring-brand",
                  fieldProps["aria-invalid"] && "border-crit",
                  disabled && "bg-surface-2 opacity-60",
                )}
              >
                {digit ? (visible ? digit : "•") : null}
              </span>
            );
          })}
        </div>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          autoComplete={autoComplete}
          // eslint-disable-next-line jsx-a11y-x/no-autofocus -- a sign-in screen exists to take the PIN; focus goes to the first empty field.
          autoFocus={autoFocus}
          disabled={disabled}
          name={name}
          value={value}
          onChange={(event) => {
            const next = toLatinDigits(event.target.value)
              .replace(/[^0-9]/g, "")
              .slice(0, length);
            onValueChange(next);
            if (next.length === length && value.length < length) onComplete?.(next);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          // Invisible but on top of the boxes, so a tap anywhere on them focuses it. 16px text keeps
          // phones from zooming in.
          className="absolute inset-0 h-full w-full cursor-text rounded-lg text-base opacity-0 disabled:cursor-not-allowed"
          {...fieldProps}
        />
      </div>
      <IconButton
        variant="ghost"
        icon={visible ? IconHide : IconShow}
        label={visible ? t("ui.pin.hide") : t("ui.pin.show")}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => {
          setVisible((shown) => !shown);
        }}
      />
    </div>
  );
}
