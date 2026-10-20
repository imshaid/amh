import { useEffect, useRef } from "react";

import { restartAnimation } from "./restart-animation";

/**
 * Briefly tints an element whenever `signal` changes after the first render, so a change that
 * arrived from another device catches the eye (BLUEPRINT §7). Attach the returned ref.
 */
export function useFlash<TElement extends HTMLElement>(signal: unknown) {
  const ref = useRef<TElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (ref.current) restartAnimation(ref.current, "animate-flash");
  }, [signal]);
  return ref;
}
