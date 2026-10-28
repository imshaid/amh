import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "@/app/shell/brand-mark";
import { usePageTitle } from "@/app/shell/page-title-context";
import { LanguageSwitch, ThemeMenu } from "@/app/shell/preference-controls";
import { useFormat } from "@/i18n/hooks";
import { isTrustedDevice } from "@/lib/auth/device-trust";
import { signInWithPin } from "@/lib/auth/member-auth";
import type { MemberAuthFailure } from "@/lib/auth/member-auth";
import { membershipQuery, safeRedirect, signOut } from "@/lib/auth/membership";
import { clientEnv } from "@/lib/env";
import { normalisePhone } from "@/lib/phone";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Field } from "@/ui/field";
import { IconPhone } from "@/ui/icons";
import { Input } from "@/ui/input";
import { Note } from "@/ui/note";
import { PinInput } from "@/ui/pin-input";

const PIN_LENGTH = 6;

/** Minutes until a lock ends, rounded up, at least one. */
function minutesUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
}

function FailureNote({ failure }: { failure: MemberAuthFailure }) {
  const { t } = useTranslation();
  const { number } = useFormat();
  switch (failure.reason) {
    case "invalid":
      return (
        <Note tone="error" role="alert">
          <p className="font-medium">{t("auth.failure.invalid")}</p>
          {failure.remaining !== null ? (
            <p>
              {failure.remaining === 1
                ? t("auth.failure.lastTry")
                : t("auth.failure.triesLeft", { tries: number(failure.remaining) })}
            </p>
          ) : null}
        </Note>
      );
    case "locked": {
      const minutes = minutesUntil(failure.retryAt);
      const wait =
        minutes <= 90
          ? t("auth.failure.waitMinutes", { count: minutes, minutes: number(minutes) })
          : t("auth.failure.waitHours", { hours: number(Math.ceil(minutes / 60)) });
      return (
        <Note tone="warning" role="alert">
          <p className="font-medium">{t("auth.failure.locked")}</p>
          <p>{t("auth.failure.lockedHelp", { wait })}</p>
        </Note>
      );
    }
    case "inactive":
      return (
        <Note tone="error" role="alert">
          {t("auth.failure.inactive")}
        </Note>
      );
    case "offline":
      return (
        <Note tone="warning" role="alert">
          {t("auth.failure.offline")}
        </Note>
      );
    case "notConfigured":
      return (
        <Note tone="warning" role="alert">
          {t("auth.failure.notConfigured")}
        </Note>
      );
    case "signedOut":
    case "unreachable":
      return (
        <Note tone="error" role="alert">
          {t("auth.failure.unreachable")}
        </Note>
      );
  }
}

/**
 * Signing in with a phone number and a 6-digit PIN, made for members who are not technical
 * (BLUEPRINT §5.9): large fields, Bangla digits welcome, a PIN entered like a mobile-banking PIN,
 * and every refusal explained.
 */
export function SignInPage({
  redirectTo,
  reason,
}: {
  redirectTo: string | undefined;
  reason: "noAccess" | undefined;
}) {
  const { t } = useTranslation();
  usePageTitle(t("auth.signIn.title"));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phoneRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [trustDevice, setTrustDevice] = useState(isTrustedDevice);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [failure, setFailure] = useState<MemberAuthFailure | null>(
    clientEnv.ok ? null : { reason: "notConfigured" },
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit(enteredPin: string) {
    if (submitting || !clientEnv.ok) return;
    const normalised = normalisePhone(phone);
    if (normalised === null) {
      setPhoneError(
        t(phone.trim() === "" ? "auth.signIn.phoneMissing" : "auth.signIn.phoneInvalid"),
      );
      phoneRef.current?.focus();
      return;
    }
    if (enteredPin.length !== PIN_LENGTH) {
      pinRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setFailure(null);
    const result = await signInWithPin({ phone: normalised, pin: enteredPin, trustDevice });
    if (result.ok) {
      const membership = await queryClient.query({ ...membershipQuery, staleTime: 0 });
      if (membership.kind === "member" || membership.kind === "unverified") {
        await navigate({ href: safeRedirect(redirectTo), replace: true });
        return;
      }
      await signOut(queryClient);
      setFailure({ reason: "inactive" });
    } else {
      setFailure(result);
    }
    setSubmitting(false);
    setPin("");
    pinRef.current?.focus();
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(pin);
  }

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(24rem,5fr)_minmax(0,7fr)]">
      {/* The hotel, in its logo's blue: a banner on phones, a full-height panel on wide screens. */}
      <header className="relative isolate overflow-hidden bg-paper-ink text-paper">
        <svg
          viewBox="0 0 600 360"
          className="pointer-events-none absolute -right-24 -bottom-10 -z-10 w-[34rem] opacity-25 max-lg:hidden"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse
            cx="300"
            cy="180"
            rx="280"
            ry="160"
            fill="none"
            strokeWidth="6"
            className="stroke-paper-soft"
          />
          <ellipse
            cx="300"
            cy="180"
            rx="240"
            ry="128"
            fill="none"
            strokeWidth="2"
            className="stroke-paper-soft"
          />
        </svg>
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6 lg:h-full lg:flex-col lg:items-start lg:justify-between lg:px-12 lg:py-12">
          <div className="flex min-w-0 items-center gap-3 lg:flex-col lg:items-start lg:gap-7">
            <BrandMark className="size-11 lg:size-20" />
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight font-strong text-balance lg:text-[2.75rem] lg:leading-[1.1]">
                {t("app.name")}
              </p>
              <p className="text-sm text-balance text-paper/85 lg:mt-3 lg:max-w-[34ch] lg:text-lg">
                {t("auth.brand.line")}
              </p>
              {/* The badge every printed document carries under the hotel's name. */}
              <p className="mt-6 hidden w-fit rounded-full bg-paper px-4 py-1.5 font-display text-sm font-semibold text-paper-ink lg:block">
                {t("auth.brand.proprietor")}
              </p>
            </div>
          </div>
          <p className="hidden text-sm text-paper/80 lg:block">{t("auth.brand.place")}</p>
        </div>
      </header>

      <main id="main" className="flex flex-col px-4 pt-3 pb-12 sm:px-6 lg:px-12 lg:pt-6">
        <div className="flex justify-end gap-2">
          <LanguageSwitch />
          <ThemeMenu />
        </div>

        <div className="mx-auto w-full max-w-sm pt-6 lg:my-auto lg:pt-0">
          <h1 className="type-title">{t("auth.signIn.title")}</h1>
          <p className="mt-1.5 text-muted">{t("auth.signIn.lead")}</p>

          {reason === "noAccess" ? (
            <Note tone="warning" className="mt-5">
              {t("auth.signIn.noAccess")}
            </Note>
          ) : null}

          <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
            <Field
              label={t("auth.signIn.phone")}
              hint={t("auth.signIn.phoneHint")}
              error={phoneError}
              required
            >
              <div className="relative">
                <IconPhone
                  className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <Input
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  // eslint-disable-next-line jsx-a11y-x/no-autofocus -- the screen exists to take the phone number; nothing else competes for focus.
                  autoFocus
                  value={phone}
                  disabled={!clientEnv.ok}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setPhoneError(undefined);
                  }}
                  className="h-13 pl-11 text-lg tracking-wide coarse:h-13"
                />
              </div>
            </Field>

            <Field label={t("auth.signIn.pin")}>
              <PinInput
                ref={pinRef}
                value={pin}
                onValueChange={setPin}
                onComplete={(completed) => void submit(completed)}
                disabled={!clientEnv.ok || submitting}
              />
            </Field>

            {failure ? <FailureNote failure={failure} /> : null}

            <Checkbox
              label={t("auth.signIn.trust")}
              hint={t("auth.signIn.trustHint")}
              checked={trustDevice}
              onCheckedChange={setTrustDevice}
              disabled={!clientEnv.ok}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={!clientEnv.ok}
            >
              {submitting ? t("auth.signIn.submitting") : t("auth.signIn.submit")}
            </Button>
          </form>

          <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
            {t("auth.signIn.forgot")}
          </p>
        </div>
      </main>
    </div>
  );
}
