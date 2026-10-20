/*
 * Motion tokens, mirrored from styles/index.css for animations driven from code. BLUEPRINT §7:
 * roughly 120–400 ms, ease-out curves, nothing that loops for decoration.
 */

/** cubic-bezier(0.2, 0.7, 0.2, 1): quick start, long soft landing. */
export const EASE_OUT = [0.2, 0.7, 0.2, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/** Seconds, as Motion expects. */
export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  slower: 0.4,
} as const;

/** Delay between items of a staggered entry. */
export const STAGGER_DELAY = 0.055;

/*
 * Data animations (counting figures, meters filling, lines drawing in) run a little longer than
 * interface motion so the change can be followed; the approved prototype used 900 ms.
 */
export const DATA_DURATION = 0.7;

/** Milliseconds a counted-up figure takes to reach its value. */
export const COUNT_UP_MS = DATA_DURATION * 1000;
