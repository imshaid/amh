import { cn } from "@/ui/cn";

/**
 * The hotel's mark, the same drawing as the app icon (public/favicon.svg): AMH in Tinos Bold with
 * the oval of the hotel's logo. It keeps the logo's own blue in both themes, like printed paper.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="512" height="512" rx="112" className="fill-paper-ink" />
      <ellipse
        cx="256"
        cy="256"
        rx="204"
        ry="124"
        fill="none"
        strokeWidth="10"
        className="stroke-paper-soft"
      />
      <path
        className="fill-paper"
        d="M120.3 290.9L130.7 292.5L130.7 297L106 297L106 292.5L112.1 290.9L141 215L158.5 215L187.3 290.9L193.5 292.5L193.5 297L157.3 297L157.3 292.5L166.7 290.9L159 269.9L127.8 269.9L120.3 290.9M156.7 263.2L143.6 227.3L130.2 263.2L156.7 263.2M278.5 228.3L247.9 297L244.5 297L214.5 228.3L214.5 290.9L225.4 292.5L225.4 297L196.5 297L196.5 292.5L206.9 290.9L206.9 221.7L196.5 220.1L196.5 215.7L228.5 215.7L251.7 269.1L275.4 215.7L308 215.7L308 220.1L297.5 221.7L297.5 290.9L308 292.5L308 297L267.5 297L267.5 292.5L278.5 290.9L278.5 228.3M353.6 297L313.7 297L313.7 292.5L324.1 290.9L324.1 221.8L313.7 220.1L313.7 215.7L353.6 215.7L353.6 220.1L343.2 221.8L343.2 251.8L376.4 251.8L376.4 221.8L365.9 220.1L365.9 215.7L406 215.7L406 220.1L395.5 221.8L395.5 290.9L406 292.5L406 297L365.9 297L365.9 292.5L376.4 290.9L376.4 258.5L343.2 258.5L343.2 290.9L353.6 292.5L353.6 297"
      />
    </svg>
  );
}
