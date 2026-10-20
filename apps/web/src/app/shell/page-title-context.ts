import { createContext, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const SetPageTitleContext = createContext<(title: string) => void>(() => undefined);
export const PageTitleContext = createContext("");

/** The current screen's title, as set by usePageTitle. */
export function useCurrentPageTitle(): string {
  return useContext(PageTitleContext);
}

/**
 * Names the current screen: the browser tab reads "<title> · <hotel name>" in the current language,
 * and the top bar shows the title.
 */
export function usePageTitle(title: string): void {
  const { t } = useTranslation();
  const setTitle = useContext(SetPageTitleContext);
  const appName = t("app.name");
  useEffect(() => {
    document.title = `${title} · ${appName}`;
    setTitle(title);
  }, [title, appName, setTitle]);
}
