import { describe, expect, it } from "vitest";

import {
  parseRate,
  priceMatch,
  priceSearch,
  rateFromNumber,
  rateKey,
  sharedRates,
  wholeTaka,
} from "./price";

describe("parseRate", () => {
  it("reads rates the way people type them", () => {
    expect(parseRate("৩৫৫")).toBe("355");
    expect(parseRate("355.5")).toBe("355.5");
    expect(parseRate("৳ 1,200")).toBe("1200");
    expect(parseRate("৫২০ টাকা")).toBe("520");
    expect(parseRate("430 tk")).toBe("430");
    expect(parseRate("007")).toBe("7");
  });

  it("refuses what is not a rate", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("fifty")).toBeNull();
    expect(parseRate("-5")).toBeNull();
    expect(parseRate("12.345")).toBeNull();
  });
});

describe("rateFromNumber", () => {
  it("keeps whole and two-decimal rates, dropping binary noise", () => {
    expect(rateFromNumber(355)).toBe("355");
    expect(rateFromNumber(355.5)).toBe("355.5");
    expect(rateFromNumber(19.990000000000002)).toBe("19.99");
  });

  it("refuses a third decimal rather than rounding it", () => {
    expect(rateFromNumber(19.995)).toBeNull();
    expect(rateFromNumber(-1)).toBeNull();
    expect(rateFromNumber(Number.NaN)).toBeNull();
  });
});

describe("comparing rates", () => {
  it("treats 60, 60.0 and 60.00 as one price", () => {
    expect(rateKey("60")).toBe("60.00");
    expect(rateKey("60.0")).toBe("60.00");
    expect(rateKey("60.00")).toBe("60.00");
    expect(rateKey("355.5")).toBe("355.50");
  });

  it("finds the taka of a rate", () => {
    expect(wholeTaka("355.50")).toBe("355");
    expect(wholeTaka("20")).toBe("20");
  });

  it("lists the prices two active packages share", () => {
    expect(
      sharedRates([
        { rate: "60.00", active: true },
        { rate: "60", active: true },
        { rate: "20.00", active: true },
        { rate: "20.00", active: false },
      ]),
    ).toEqual(new Set(["60.00"]));
  });
});

describe("searching by price", () => {
  it("knows a price search from a name search, in either digits", () => {
    expect(priceSearch("৪৩০")).toBe("430");
    expect(priceSearch("৳ 430")).toBe("430");
    expect(priceSearch("Lunch 430")).toBeNull();
    expect(priceSearch("")).toBeNull();
  });

  it("matches the whole price or its start", () => {
    expect(priceMatch("430.00", "430")).toBe("exact");
    expect(priceMatch("430.00", "43")).toBe("prefix");
    expect(priceMatch("1430.00", "430")).toBeNull();
  });
});
