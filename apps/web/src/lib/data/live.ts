import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import type { Tables } from "@/lib/database.gen";
import type { AppSupabaseClient } from "@/lib/supabase";

/*
 * Live by default (BLUEPRINT §2.8). Every business change writes one audit row, and Realtime sends
 * those rows to every signed-in device (RLS applies). Each row says which table and record changed,
 * so this module refetches the screens that show it and briefly highlights the record.
 */

/** The first element of every query key; one per kind of screen data. */
export type QueryRoot = "clients" | "locations" | "contacts" | "packages";

const ROOTS_BY_TABLE: Partial<Record<string, readonly QueryRoot[]>> = {
  organisations: ["clients"],
  projects: ["clients"],
  log_codes: ["clients"],
  bills: ["clients"],
  payments: ["clients"],
  payment_allocations: ["clients"],
  areas: ["locations", "contacts"],
  // Contacts list the places they serve, and places list their contacts.
  locations: ["locations", "contacts"],
  location_aliases: ["locations"],
  contacts: ["contacts", "locations"],
  contact_locations: ["contacts", "locations"],
  challans: ["locations"],
  package_categories: ["packages"],
  packages: ["packages"],
  package_client_codes: ["packages"],
};

/** Columns that point at the record a child row belongs to, which is flashed with it. */
const PARENT_COLUMNS = [
  "location_id",
  "contact_id",
  "package_id",
  "project_id",
  "organisation_id",
] as const;

export type AuditChange = Pick<
  Tables<"audit_log">,
  "entity_type" | "entity_id" | "action" | "before" | "after"
>;

export function rootsFor(change: Pick<AuditChange, "entity_type">): readonly QueryRoot[] {
  return ROOTS_BY_TABLE[change.entity_type] ?? [];
}

/** The records a change touched: the row itself and the records it belongs to. */
export function changedIds(change: AuditChange): string[] {
  const ids = new Set<string>();
  if (change.entity_id) ids.add(change.entity_id);
  for (const row of [change.after, change.before]) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
    for (const column of PARENT_COLUMNS) {
      const value = row[column];
      if (typeof value === "string") ids.add(value);
    }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------------------------
// Store: the connection state and a change counter per record
// ---------------------------------------------------------------------------------------------

export type LiveConnection = "connecting" | "live" | "down";

let connection: LiveConnection = "connecting";
const connectionListeners = new Set<() => void>();
const signals = new Map<string, number>();
const signalListeners = new Set<() => void>();

function setConnection(next: LiveConnection) {
  if (next === connection) return;
  connection = next;
  for (const listener of connectionListeners) listener();
}

function bump(ids: readonly string[]) {
  if (ids.length === 0) return;
  for (const id of ids) signals.set(id, (signals.get(id) ?? 0) + 1);
  for (const listener of signalListeners) listener();
}

export function useLiveConnection(): LiveConnection {
  return useSyncExternalStore(
    (listener) => {
      connectionListeners.add(listener);
      return () => connectionListeners.delete(listener);
    },
    () => connection,
  );
}

/** A number that goes up whenever a live change touches the record: feed it to `useFlash`. */
export function useLiveSignal(id: string): number {
  return useSyncExternalStore(
    (listener) => {
      signalListeners.add(listener);
      return () => signalListeners.delete(listener);
    },
    () => signals.get(id) ?? 0,
  );
}

/** Refetches what a change affects, then flashes the records once the new data is on screen. */
export async function applyChange(queryClient: QueryClient, change: AuditChange): Promise<void> {
  await Promise.all(
    rootsFor(change).map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  );
  bump(changedIds(change));
}

function isAuditChange(row: unknown): row is AuditChange {
  return (
    typeof row === "object" &&
    row !== null &&
    "entity_type" in row &&
    typeof row.entity_type === "string"
  );
}

/**
 * Listens for audit rows while a member is signed in. After a dropped connection everything is
 * refetched, since changes made in the meantime were missed. Returns the function that stops it.
 */
export function startLiveSync(supabase: AppSupabaseClient, queryClient: QueryClient): () => void {
  let missedChanges = false;
  setConnection("connecting");
  const channel = supabase
    .channel("audit-log")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "audit_log" },
      (payload) => {
        if (isAuditChange(payload.new)) void applyChange(queryClient, payload.new);
      },
    )
    .subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        setConnection("live");
        if (missedChanges) {
          missedChanges = false;
          void queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] !== "membership",
          });
        }
      } else if (
        status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
        status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
      ) {
        missedChanges = true;
        setConnection("down");
      }
    });
  return () => {
    void supabase.removeChannel(channel);
    setConnection("connecting");
  };
}

/** For tests: forget the connection state and every counter. */
export function resetLiveStore(): void {
  connection = "connecting";
  signals.clear();
  for (const listener of [...connectionListeners, ...signalListeners]) listener();
}
