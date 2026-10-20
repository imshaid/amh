import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's default scale names, so it is told about the ones in
 * styles/index.css. Without this, `cn("text-sm", "text-ui")` would keep both sizes.
 */
const merge = extendTailwindMerge<"type-role">({
  extend: {
    theme: {
      text: ["ui"],
      shadow: ["raised", "paper", "fab"],
      "font-weight": ["heading", "strong"],
      animate: ["rise", "fade-in", "flash", "shimmer", "pulse-once"],
    },
    classGroups: {
      "type-role": [{ type: ["hero", "title", "heading", "subheading", "figure", "overline"] }],
    },
  },
});

/** Joins class names, letting later Tailwind classes override earlier ones of the same kind. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
