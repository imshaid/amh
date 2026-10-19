import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import type { RouterContext } from "@/app/router";
import { UpdatePrompt } from "@/app/update-prompt";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

function Root() {
  return (
    <>
      <Outlet />
      <UpdatePrompt />
    </>
  );
}
