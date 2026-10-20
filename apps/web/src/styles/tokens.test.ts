import { describe, expect, it } from "vitest";

import { THEME_COLORS } from "@/lib/theme";

import tokensCss from "./tokens.css?raw";

/*
 * Guards the colour tokens: every text pair the components use meets WCAG AA (4.5:1), and every
 * control edge or status mark that carries meaning meets 3:1 (WCAG 1.4.11), in both themes.
 */

type Theme = Map<string, string>;

function declarations(block: string): Theme {
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value.trim());
  }
  return tokens;
}

function parseThemes(css: string): { light: Theme; dark: Theme } {
  const darkStart = css.indexOf("@variant dark");
  if (darkStart === -1) throw new Error("tokens.css has no dark block");
  const light = declarations(css.slice(0, darkStart));
  const dark = new Map([...light, ...declarations(css.slice(darkStart))]);
  return { light, dark };
}

function hex(theme: Theme, token: string): string {
  const value = theme.get(`--${token}`);
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`--${token} is not a 6-digit hex colour: ${String(value)}`);
  }
  return value;
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

const SURFACES = ["bg", "surface", "surface-2", "surface-raised"];

/** [foreground, background] pairs used for text. */
const TEXT_PAIRS: [string, string][] = [
  ...["ink", "ink-2", "muted"].flatMap((text) =>
    SURFACES.map((surface): [string, string] => [text, surface]),
  ),
  ["brand", "surface"],
  ["brand", "bg"],
  ["brand-ink", "brand"],
  ["brand-ink", "brand-strong"],
  ["brand-strong", "brand-soft"],
  ["ink-2", "brand-soft"],
  ["surface", "ink"],
  ["turmeric-ink", "turmeric-soft"],
  ["turmeric-ink", "surface"],
  ["good-ink", "good-soft"],
  ["good-ink", "surface"],
  ["warn-ink", "warn-soft"],
  ["warn-ink", "surface"],
  ["serious-ink", "serious-soft"],
  ["serious-ink", "surface"],
  ["crit-ink", "crit-soft"],
  ["crit-ink", "surface"],
  ["crit-ink", "surface-raised"],
  ["toast-ink", "toast"],
  ["toast-muted", "toast"],
  ["paper-ink", "paper"],
  ["paper-ink", "paper-soft"],
];

/** [mark, background] pairs where the mark itself carries meaning. */
const NON_TEXT_PAIRS: [string, string][] = [
  ["field-line", "surface"],
  ["field-line", "surface-raised"],
  ["field-line", "bg"],
  ["brand", "surface"],
  ["brand", "surface-raised"],
  ["turmeric", "surface"],
  ["good", "surface"],
  ["crit", "surface"],
  ["toast-info", "toast"],
  ["toast-good", "toast"],
  ["toast-warn", "toast"],
  ["toast-crit", "toast"],
];

const themes = parseThemes(tokensCss);

describe.each(Object.entries(themes))("%s theme", (_name, theme) => {
  it.each(TEXT_PAIRS)("%s text on %s meets 4.5:1", (foreground, background) => {
    expect(contrast(hex(theme, foreground), hex(theme, background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)("%s on %s meets 3:1", (mark, background) => {
    expect(contrast(hex(theme, mark), hex(theme, background))).toBeGreaterThanOrEqual(3);
  });
});

describe("theme colours used outside CSS", () => {
  it("match the page background tokens", () => {
    expect(THEME_COLORS.light).toBe(hex(themes.light, "bg"));
    expect(THEME_COLORS.dark).toBe(hex(themes.dark, "bg"));
  });
});
