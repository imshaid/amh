import { domMax, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { DURATION, EASE_OUT } from "./tokens";

/**
 * Sets up Motion for the whole app: only the small `m.*` components are allowed (strict), and a
 * user's reduced-motion setting turns transforms off. The animation features load with the app
 * rather than after it: every screen enters with an animation that needs them, so loading them
 * later would only keep the first screen invisible for a network round trip.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE_OUT }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
