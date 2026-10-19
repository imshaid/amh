import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR = 60 * 60 * 1000;

/** Offers a newly deployed version of the app; Segment 1 restyles it as a toast. */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days; look for a new version every hour.
      if (registration) {
        setInterval(() => {
          void registration.update();
        }, HOUR);
      }
    },
  });

  if (!needRefresh) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 flex flex-wrap items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-raised md:right-6 md:left-auto md:max-w-md"
    >
      <p className="min-w-0 flex-1">{t("pwa.updateReady")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 font-semibold text-surface/80 hover:text-surface"
          onClick={() => {
            setNeedRefresh(false);
          }}
        >
          {t("pwa.later")}
        </button>
        <button
          type="button"
          className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-brand-ink"
          onClick={() => void updateServiceWorker()}
        >
          {t("pwa.reload")}
        </button>
      </div>
    </div>
  );
}
