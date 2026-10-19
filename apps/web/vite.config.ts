import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

import { findClientEnvProblems } from "./src/lib/client-env-policy.ts";

/** Fails dev and build when the environment would put something secret into the bundle. */
function clientEnvGuard(): Plugin {
  return {
    name: "amh:client-env-guard",
    configResolved(config) {
      const problems = findClientEnvProblems(config.env);
      if (problems.length > 0) {
        throw new Error(`Refusing to bundle this environment:\n- ${problems.join("\n- ")}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    clientEnvGuard(),
    // Must run before the React plugin. Generates src/routeTree.gen.ts and splits each route's
    // component into its own chunk.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      quoteStyle: "double",
      semicolons: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
