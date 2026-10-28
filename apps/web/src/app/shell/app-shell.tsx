import { Outlet, useRouterState } from "@tanstack/react-router";
import * as m from "motion/react-m";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useMember } from "@/lib/auth/membership";
import { useApplyMemberPreferences } from "@/lib/auth/preferences";
import { DURATION, EASE_OUT } from "@/ui/motion/tokens";

import { BottomBar } from "./bottom-bar";
import { CommandBar } from "./command-bar";
import { PageTitleProvider } from "./page-title";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Moves keyboard and screen-reader focus to the new screen after a navigation, so the next Tab
 * starts at the top of the content, not on the menu link that was pressed.
 */
function useFocusOnNavigation(pathname: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname]);
}

/**
 * The signed-in frame (BLUEPRINT §5.1): a sidebar on wide screens, a bottom bar on phones and
 * tablets, a sticky top bar everywhere, and the Ctrl+K command bar.
 */
export function AppShell() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useFocusOnNavigation(pathname);
  useApplyMemberPreferences(useMember());

  return (
    <PageTitleProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15.25rem_minmax(0,1fr)]">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-surface px-3 py-2 font-semibold shadow-raised focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {t("nav.skipToContent")}
        </a>
        <Sidebar className="hidden lg:flex" />
        <div className="flex min-w-0 flex-col">
          <TopBar />
          <main
            id="main"
            tabIndex={-1}
            className="w-full max-w-360 px-4 pt-5 pb-32 outline-none sm:px-6 lg:px-7 lg:pt-6 lg:pb-16"
          >
            {/* Each screen fades and rises in briefly; the old one leaves at once. */}
            <m.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE_OUT }}
            >
              <Outlet />
            </m.div>
          </main>
        </div>
        <BottomBar className="lg:hidden" />
        <CommandBar />
      </div>
    </PageTitleProvider>
  );
}
