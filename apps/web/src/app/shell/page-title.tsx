import { useState } from "react";
import type { ReactNode } from "react";

import { PageTitleContext, SetPageTitleContext } from "./page-title-context";

/** Holds the title of the screen being shown, for the top bar. */
export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  return (
    <SetPageTitleContext value={setTitle}>
      <PageTitleContext value={title}>{children}</PageTitleContext>
    </SetPageTitleContext>
  );
}
