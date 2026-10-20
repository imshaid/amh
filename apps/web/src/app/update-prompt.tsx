import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

import { toast } from "@/ui/toast/toast-store";

const HOUR = 60 * 60 * 1000;

/**
 * Offers a newly deployed version of the app as a toast that waits for the user: reloading on its
 * own could lose half-typed work. Dismissing it means "later".
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
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

  useEffect(() => {
    if (!needRefresh) return;
    const id = toast.show({
      title: t("pwa.updateReady"),
      description: t("pwa.updateHint"),
      tone: "info",
      duration: Infinity,
      action: {
        label: t("pwa.reload"),
        onAction: () => void updateServiceWorker(),
      },
    });
    return () => {
      toast.dismiss(id);
    };
  }, [needRefresh, t, updateServiceWorker]);

  return null;
}
