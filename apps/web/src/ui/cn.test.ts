import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("lets a later size, radius or shadow from our scales win", () => {
    expect(cn("text-sm", "text-ui")).toBe("text-ui");
    expect(cn("text-ui", "text-base")).toBe("text-base");
    expect(cn("rounded-lg", "rounded-xl")).toBe("rounded-xl");
    expect(cn("shadow-raised", "shadow-paper")).toBe("shadow-paper");
    expect(cn("font-heading", "font-semibold")).toBe("font-semibold");
    expect(cn("type-heading", "type-title")).toBe("type-title");
  });

  it("keeps a colour and a size side by side", () => {
    expect(cn("text-ui", "text-brand-strong")).toBe("text-ui text-brand-strong");
    expect(cn("bg-surface", "bg-brand-soft")).toBe("bg-brand-soft");
  });

  it("drops falsy values", () => {
    expect(cn("px-3", false, undefined, null, "py-2")).toBe("px-3 py-2");
  });
});
