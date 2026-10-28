import { cn } from "./cn";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The first letter of a name as people read it: "জিয়া" -> "জি", "Alif" -> "A". */
function initialOf(name: string): string {
  const [first] = segmenter.segment(name.trim());
  return first ? first.segment.toLocaleUpperCase() : "";
}

/** A member shown by their initial, as in the prototype's sidebar. Decorative: show the name too. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-sm font-semibold text-brand-strong",
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
