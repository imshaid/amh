import { QueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppSupabaseClient } from "@/lib/supabase";
import { createFakeSupabase } from "@/test/fake-supabase";

import {
  applyChange,
  changedIds,
  resetLiveStore,
  rootsFor,
  startLiveSync,
  useLiveConnection,
  useLiveSignal,
} from "./live";
import type { AuditChange } from "./live";

afterEach(() => {
  resetLiveStore();
  vi.useRealTimers();
});

const ALIAS_ADDED: AuditChange = {
  entity_type: "location_aliases",
  entity_id: "alias-1",
  action: "insert",
  before: null,
  after: { id: "alias-1", location_id: "place-1", alias: "Darapra" },
};

describe("which screens a change touches", () => {
  it("refetches every screen that shows the changed table", () => {
    expect(rootsFor({ entity_type: "packages" })).toEqual(["packages"]);
    expect(rootsFor({ entity_type: "contact_locations" })).toEqual(["contacts", "locations"]);
    expect(rootsFor({ entity_type: "payment_allocations" })).toEqual(["clients"]);
  });

  it("ignores tables no screen shows yet", () => {
    expect(rootsFor({ entity_type: "issued_documents" })).toEqual([]);
  });

  it("flashes the row and the record it belongs to", () => {
    expect(changedIds(ALIAS_ADDED)).toEqual(["alias-1", "place-1"]);
  });

  it("finds the parent of a deleted row in its old values", () => {
    expect(
      changedIds({
        entity_type: "contact_locations",
        entity_id: "link-1",
        action: "delete",
        before: { contact_id: "contact-1", location_id: "place-1", project_id: null },
        after: null,
      }),
    ).toEqual(["link-1", "place-1", "contact-1"]);
  });
});

describe("applying a change", () => {
  it("refetches, then raises the signal of each touched record", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => [useLiveSignal("place-1"), useLiveSignal("other")]);
    expect(result.current).toEqual([0, 0]);

    await act(() => applyChange(queryClient, ALIAS_ADDED));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["locations"] });
    expect(result.current).toEqual([1, 0]);
  });
});

describe("the live channel", () => {
  function setUp() {
    const fake = createFakeSupabase({
      session: null,
      profile: null,
      memberAuth: () => ({ status: "network" }),
    });
    const queryClient = new QueryClient();
    const client = fake.client as unknown as AppSupabaseClient;
    return { fake, queryClient, client };
  }

  it("is live once subscribed and applies arriving changes", async () => {
    vi.useFakeTimers();
    const { fake, queryClient, client } = setUp();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLiveConnection());

    const stop = startLiveSync(client, queryClient);
    expect(result.current).toBe("connecting");
    await act(() => vi.runAllTimersAsync());
    expect(result.current).toBe("live");

    fake.pushChange({ ...ALIAS_ADDED, entity_type: "packages", entity_id: "pkg-1" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["packages"] });

    stop();
    expect(fake.client.removeChannel).toHaveBeenCalled();
  });

  it("refetches everything after a dropped connection comes back", async () => {
    vi.useFakeTimers();
    const { fake, queryClient, client } = setUp();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLiveConnection());

    startLiveSync(client, queryClient);
    await act(() => vi.runAllTimersAsync());
    expect(invalidate).not.toHaveBeenCalled();

    act(() => {
      fake.reportStatus("CHANNEL_ERROR");
    });
    expect(result.current).toBe("down");
    act(() => {
      fake.reportStatus("SUBSCRIBED");
    });
    expect(result.current).toBe("live");
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
