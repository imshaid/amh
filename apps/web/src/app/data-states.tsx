import { useTranslation } from "react-i18next";

import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { IconError, IconRetry, IconServerOff } from "@/ui/icons";
import { Note } from "@/ui/note";

import { useProblemText } from "./problem-text";

/** A screen's data cannot exist yet: no backend is configured (UI preview). */
export function NotConfiguredState() {
  const { t } = useTranslation();
  return (
    <EmptyState
      kind="unavailable"
      icon={IconServerOff}
      title={t("data.notConfigured.title")}
      body={t("data.notConfigured.body")}
    />
  );
}

/** A screen's data did not load: why, and a way to try again. */
export function LoadErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const problemText = useProblemText();
  return (
    <EmptyState
      kind="error"
      icon={IconError}
      title={t("data.loadError.title")}
      body={problemText(error)}
      actions={
        <Button onClick={onRetry}>
          <IconRetry aria-hidden="true" />
          {t("data.loadError.retry")}
        </Button>
      }
    />
  );
}

/** A failed save or delete, inside the panel where it happened. */
export function ProblemNote({ error, message }: { error: unknown; message?: string }) {
  const problemText = useProblemText();
  if (!error) return null;
  return (
    <Note tone="error" role="alert">
      {message ?? problemText(error)}
    </Note>
  );
}
