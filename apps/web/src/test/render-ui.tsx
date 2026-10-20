import "@/i18n/i18n";

import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import { MotionProvider } from "@/ui/motion/motion-provider";

/** Renders one component with the providers the app gives every screen. */
export function renderUi(ui: ReactElement) {
  return render(<MotionProvider>{ui}</MotionProvider>);
}
