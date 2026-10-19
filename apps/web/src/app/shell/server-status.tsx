import { useTranslation } from "react-i18next";

import { useServerStatus } from "@/lib/server-status";
import type { ServerStatus } from "@/lib/server-status";

const DOT: Record<ServerStatus, string> = {
  checking: "bg-line-strong",
  connected: "bg-good",
  unreachable: "bg-crit",
  notConfigured: "bg-warn",
};

/** Foundation-level backend check; Segment 1 turns it into the live indicator in the top bar. */
export function ServerStatusLine() {
  const { t } = useTranslation();
  const status = useServerStatus();
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-2">
      <span aria-hidden="true" className={`size-2 rounded-full ${DOT[status]}`} />
      {t("server.status", { state: t(`server.states.${status}`) })}
    </p>
  );
}
