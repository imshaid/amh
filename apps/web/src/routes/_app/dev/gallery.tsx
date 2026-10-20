import { createFileRoute } from "@tanstack/react-router";

import { GalleryPage } from "@/dev/gallery/gallery-page";

export const Route = createFileRoute("/_app/dev/gallery")({
  component: GalleryPage,
});
