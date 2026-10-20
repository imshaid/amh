import { describe, expect, it } from "vitest";

import { matchCommand } from "./command-filter";

describe("matchCommand", () => {
  it("matches every word of the search, in any order", () => {
    expect(matchCommand("page:/packages", "দাম প্যাকেজ", ["প্যাকেজ ও দাম", "Packages"])).toBe(1);
    expect(matchCommand("page:/packages", "দাম অর্ডার", ["প্যাকেজ ও দাম", "Packages"])).toBe(0);
  });

  it("finds items in either language", () => {
    expect(matchCommand("page:/orders", "orders", ["অর্ডার", "Orders"])).toBe(1);
    expect(matchCommand("page:/orders", "অর্ডার", ["অর্ডার", "Orders"])).toBe(1);
  });

  it("treats Bangla and Latin digits alike", () => {
    expect(matchCommand("package:430", "৪৩০", ["Lunch Basic-07"])).toBe(1);
    expect(matchCommand("order:০০৪৭", "47", [])).toBe(1);
  });

  it("ignores case and shows everything for an empty search", () => {
    expect(matchCommand("page:/clients", "CLIENTS", ["Clients"])).toBe(1);
    expect(matchCommand("page:/clients", "   ", [])).toBe(1);
  });
});
