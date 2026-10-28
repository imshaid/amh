import { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { problemOf } from "./problems";
import { DataError } from "./result";

function failed(code: string, message = "") {
  return new DataError(new PostgrestError({ code, message, details: "", hint: "" }));
}

describe("problemOf", () => {
  it("names the unique constraint a duplicate broke", () => {
    expect(
      problemOf(
        failed("23505", 'duplicate key value violates unique constraint "packages_name_key"'),
      ),
    ).toEqual({ kind: "duplicate", constraint: "packages_name_key" });
  });

  it("says a record still in use cannot go", () => {
    expect(
      problemOf(failed("23503", 'violates foreign key constraint "challans_location_id_fkey"')),
    ).toEqual({ kind: "inUse", constraint: "challans_location_id_fkey" });
  });

  it("reads refused values, locks and lost access", () => {
    expect(problemOf(failed("23514")).kind).toBe("invalid");
    expect(problemOf(failed("AMH05")).kind).toBe("invalid");
    expect(problemOf(failed("AMH01")).kind).toBe("locked");
    expect(problemOf(failed("42501")).kind).toBe("notAllowed");
  });

  it("tells a dead connection from a server that did not answer", () => {
    expect(problemOf(failed("", "TypeError: Failed to fetch")).kind).toBe("unreachable");
    expect(problemOf(new TypeError("Failed to fetch")).kind).toBe("unreachable");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(problemOf(failed("23505")).kind).toBe("offline");
  });

  it("does not guess at anything else", () => {
    expect(problemOf(new Error("boom")).kind).toBe("unknown");
    expect(problemOf(failed("XX000")).kind).toBe("unknown");
  });
});
