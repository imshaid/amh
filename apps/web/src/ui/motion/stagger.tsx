import * as m from "motion/react-m";
import type { Variants } from "motion/react";
import type { ComponentProps } from "react";

import { DURATION, EASE_OUT, STAGGER_DELAY } from "./tokens";

const container: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: STAGGER_DELAY } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: DURATION.slower, ease: EASE_OUT } },
};

/** Its StaggerItem children rise into place one after another when it first appears. */
export function Stagger(props: ComponentProps<typeof m.div>) {
  return <m.div variants={container} initial="hidden" animate="shown" {...props} />;
}

export function StaggerItem(props: ComponentProps<typeof m.div>) {
  return <m.div variants={item} {...props} />;
}
