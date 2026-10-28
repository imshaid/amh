import type { ReactNode } from "react";

import { useMediaQuery, WIDE_QUERY } from "@/lib/use-media-query";

import { Dialog } from "./dialog";
import { Sheet } from "./sheet";

/**
 * Where a record is added or edited: a dialog on wide screens, a sheet from the bottom on phones,
 * with the same title, body and actions. Give the form an id and its submit button `form={id}`,
 * since the footer sits outside the form.
 */
export function EditorPanel({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "lg",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const wide = useMediaQuery(WIDE_QUERY, true);
  const shared = { open, onOpenChange, title, description, footer, children };
  return wide ? <Dialog size={size} {...shared} /> : <Sheet {...shared} />;
}
