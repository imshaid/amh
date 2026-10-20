import { useSyncExternalStore } from "react";

export type ToastTone = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  /** Already translated: callers pass t("…"). */
  title: string;
  description?: string;
  tone?: ToastTone;
  /**
   * For long jobs such as PDF batches: the toast shows a bar and "done/total", and stays open until
   * it is updated with a finite `duration` (or dismissed).
   */
  progress?: { done: number; total: number };
  action?: { label: string; onAction: () => void };
  /** Milliseconds before it closes by itself; Infinity keeps it open. */
  duration?: number;
}

export interface ToastRecord extends ToastOptions {
  id: string;
  open: boolean;
}

/** How long a toast stays after it closes, so its exit animation can finish. */
const REMOVE_AFTER_MS = 400;
/** Older toasts give way when more than this many are open. */
const MAX_OPEN = 3;

let records: readonly ToastRecord[] = [];
let nextId = 0;
const listeners = new Set<() => void>();

function emit(next: readonly ToastRecord[]): void {
  records = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function scheduleRemoval(id: string): void {
  setTimeout(() => {
    emit(records.filter((record) => record.id !== id || record.open));
  }, REMOVE_AFTER_MS);
}

/** Shows and controls toasts from anywhere (event handlers, mutations, the service worker). */
export const toast = {
  show(options: ToastOptions): string {
    nextId += 1;
    const id = `toast-${String(nextId)}`;
    const open = records.filter((record) => record.open);
    const overflow = open
      .slice(0, Math.max(0, open.length - MAX_OPEN + 1))
      .map((record) => record.id);
    emit([
      ...records.map((record) =>
        overflow.includes(record.id) ? { ...record, open: false } : record,
      ),
      { ...options, id, open: true },
    ]);
    for (const closed of overflow) scheduleRemoval(closed);
    return id;
  },

  update(id: string, patch: Partial<ToastOptions>): void {
    emit(records.map((record) => (record.id === id ? { ...record, ...patch } : record)));
  },

  dismiss(id: string): void {
    if (!records.some((record) => record.id === id && record.open)) return;
    emit(records.map((record) => (record.id === id ? { ...record, open: false } : record)));
    scheduleRemoval(id);
  },
};

export function useToasts(): readonly ToastRecord[] {
  return useSyncExternalStore(
    subscribe,
    () => records,
    () => records,
  );
}

/** Test helper: forget every toast. */
export function resetToasts(): void {
  emit([]);
}
