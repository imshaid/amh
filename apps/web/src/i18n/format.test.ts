import { describe, expect, it } from "vitest";

import { formatMoney, formatNumber, toBanglaDigits, toLatinDigits } from "./format";

describe("toBanglaDigits / toLatinDigits", () => {
  it("swaps only the digits", () => {
    expect(toBanglaDigits("10/08/2026 - Lunch-430")).toBe("১০/০৮/২০২৬ - Lunch-৪৩০");
    expect(toLatinDigits("৪৩০ টাকার প্যাকেট")).toBe("430 টাকার প্যাকেট");
  });

  it("round-trips", () => {
    expect(toLatinDigits(toBanglaDigits("01715-204224"))).toBe("01715-204224");
  });
});

describe("formatNumber", () => {
  it("groups the South Asian way in both languages", () => {
    expect(formatNumber(111880, "en")).toBe("1,11,880");
    expect(formatNumber(111880, "bn")).toBe("১,১১,৮৮০");
  });

  it("formats decimal strings exactly", () => {
    expect(formatNumber("12345678901.23", "en", 2)).toBe("12,34,56,78,901.23");
  });
});

describe("formatMoney", () => {
  it("prefixes the taka sign and drops zero paisa by default", () => {
    expect(formatMoney(69270, "en")).toBe("৳69,270");
    expect(formatMoney("102620.00", "bn")).toBe("৳১,০২,৬২০");
  });

  it("shows paisa when the amount has them", () => {
    expect(formatMoney("78669.74", "en")).toBe("৳78,669.74");
    expect(formatMoney("78669.74", "bn")).toBe("৳৭৮,৬৬৯.৭৪");
    expect(formatMoney("50.5", "en")).toBe("৳50.50");
  });

  it("can force a fixed number of decimals", () => {
    expect(formatMoney("102620", "en", { decimals: 2 })).toBe("৳1,02,620.00");
    expect(formatMoney("78669.74", "en", { decimals: 0 })).toBe("৳78,670");
  });

  it("puts a true minus sign before the taka sign", () => {
    expect(formatMoney("-1200", "en")).toBe("−৳1,200");
    expect(formatMoney("-0.00", "en")).toBe("৳0");
  });

  it("rejects values that are not plain decimals", () => {
    expect(() => formatMoney("1,200", "en")).toThrow(RangeError);
    expect(() => formatMoney("৳50", "en")).toThrow(RangeError);
    expect(() => formatMoney(Number.NaN, "en")).toThrow(RangeError);
  });
});
