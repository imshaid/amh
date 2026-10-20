import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { DURATION, EASE_OUT } from "./tokens";

const loadFeatures = () => import("./features").then((module) => module.default);

/**
 * Sets up Motion for the whole app: features load after first paint, `m.*` components are the
 * only ones allowed (strict), and a user's reduced-motion setting turns transforms off.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE_OUT }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
