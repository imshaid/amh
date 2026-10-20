import type { ReactNode } from "react";

import { cn } from "@/ui/cn";

/** One part of the gallery: a heading the section nav can jump to, a sentence, and specimens. */
export function GallerySection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-32 flex-col gap-4">
      <div className="border-t border-line-strong pt-6">
        <h2 id={`${id}-title`} className="font-display text-2xl font-strong">
          {title}
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** A labelled sample inside a section. */
export function Specimen({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4",
        className,
      )}
    >
      <h3 className="type-overline">{label}</h3>
      {children}
    </div>
  );
}
