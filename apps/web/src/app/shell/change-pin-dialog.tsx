import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

import { useFormat } from "@/i18n/hooks";
import { changePin } from "@/lib/auth/member-auth";
import type { MemberAuthFailure } from "@/lib/auth/member-auth";
import { signOut } from "@/lib/auth/membership";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { Field } from "@/ui/field";
import { Note } from "@/ui/note";
import { PinInput } from "@/ui/pin-input";
import { toast } from "@/ui/toast/toast-store";

const PIN_LENGTH = 6;

type Problem = "incomplete" | "same" | "mismatch" | MemberAuthFailure;

function ProblemNote({ problem }: { problem: Problem }) {
  const { t } = useTranslation();
  const { number } = useFormat();
  if (problem === "incomplete" || problem === "same" || problem === "mismatch") {
    return (
      <Note tone="error" role="alert">
        {t(`member.changePin.problems.${problem}`)}
      </Note>
    );
  }
  switch (problem.reason) {
    case "invalid":
      return (
        <Note tone="error" role="alert">
          {problem.remaining !== null && problem.remaining > 0
            ? t("member.changePin.problems.wrongCurrent", { tries: number(problem.remaining) })
            : t("member.changePin.problems.wrongCurrentNoCount")}
        </Note>
      );
    case "locked":
      return (
        <Note tone="warning" role="alert">
          {t("member.changePin.problems.locked")}
        </Note>
      );
    case "offline":
      return (
        <Note tone="warning" role="alert">
          {t("auth.failure.offline")}
        </Note>
      );
    default:
      return (
        <Note tone="error" role="alert">
          {t("auth.failure.unreachable")}
        </Note>
      );
  }
}

/** Changing one's own PIN: the current one first, then the new one twice. */
export function ChangePinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setRepeat("");
    setProblem(null);
    setSaving(false);
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if ([current, next, repeat].some((pin) => pin.length !== PIN_LENGTH)) {
      setProblem("incomplete");
      return;
    }
    if (next === current) {
      setProblem("same");
      return;
    }
    if (next !== repeat) {
      setProblem("mismatch");
      return;
    }
    setSaving(true);
    setProblem(null);
    const result = await changePin({ currentPin: current, newPin: next });
    setSaving(false);
    if (result.ok) {
      onOpenChange(false);
      reset();
      toast.show({ tone: "success", title: t("member.changePin.done") });
      return;
    }
    if (result.reason === "signedOut" || result.reason === "inactive") {
      onOpenChange(false);
      await signOut(queryClient);
      return;
    }
    setCurrent("");
    setProblem(result);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) reset();
        onOpenChange(isOpen);
      }}
      title={t("member.changePin.title")}
      description={t("member.changePin.lead")}
      size="sm"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        currentRef.current?.focus();
      }}
    >
      <form
        id="change-pin"
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Field label={t("member.changePin.current")}>
          <PinInput ref={currentRef} value={current} onValueChange={setCurrent} disabled={saving} />
        </Field>
        <Field label={t("member.changePin.next")}>
          <PinInput
            value={next}
            onValueChange={setNext}
            autoComplete="new-password"
            disabled={saving}
          />
        </Field>
        <Field label={t("member.changePin.repeat")}>
          <PinInput
            value={repeat}
            onValueChange={setRepeat}
            autoComplete="new-password"
            disabled={saving}
          />
        </Field>
        {problem ? <ProblemNote problem={problem} /> : null}
        <Button type="submit" variant="primary" size="lg" loading={saving}>
          {t("member.changePin.submit")}
        </Button>
      </form>
    </Dialog>
  );
}
