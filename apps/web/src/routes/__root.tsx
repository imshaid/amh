import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { AuthWatcher } from "@/app/auth-watcher";
import type { RouterContext } from "@/app/router";
import { UpdatePrompt } from "@/app/update-prompt";
import { IconProvider } from "@/ui/icons";
import { MotionProvider } from "@/ui/motion/motion-provider";
import { Toaster } from "@/ui/toast/toaster";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

function Root() {
  return (
    // Icons default to the prototype's 18px at a 1.75px stroke; components size them by context.
    <IconProvider size={18} strokeWidth={1.75}>
      <MotionProvider>
        <Outlet />
        <AuthWatcher />
        <Toaster />
        <UpdatePrompt />
      </MotionProvider>
    </IconProvider>
  );
}
