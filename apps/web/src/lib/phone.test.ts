import { describe, expect, it } from "vitest";

import { formatPhone, normalisePhone } from "./phone";

describe("normalisePhone", () => {
  it.each([
    ["01715204224", "01715204224"],
    ["০১৭১৫-২০৪২২৪", "01715204224"],
    ["+880 1715 204224", "01715204224"],
    ["8801715204224", "01715204224"],
    ["1638387433.0", "01638387433"],
    ["1638387433", "01638387433"],
    ["  01937-581298 ", "01937581298"],
  ])("reads %s as %s", (raw, expected) => {
    expect(normalisePhone(raw)).toBe(expected);
  });

  it.each(["", "0171520422", "01215204224", "017152042245", "phone"])("refuses %j", (raw) => {
    expect(normalisePhone(raw)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("writes numbers the way the hotel does", () => {
    expect(formatPhone("01715204224")).toBe("01715-204224");
  });

  it("leaves anything else alone", () => {
    expect(formatPhone("12345")).toBe("12345");
  });
});
