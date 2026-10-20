import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

/** Opens or closes the command bar from anywhere: the top bar, the More sheet, Ctrl+K. */
export const commandBar = {
  open: () => {
    set(true);
  },
  close: () => {
    set(false);
  },
  setOpen: set,
};

export function useCommandBarOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => open,
    () => false,
  );
}
