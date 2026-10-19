import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { buildHeadersFile } from "./build/security-headers.ts";
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

/** Writes Cloudflare Pages' _headers file, with a CSP that names the configured Supabase project. */
function cloudflareHeaders(): Plugin {
  let supabaseUrl: string | undefined;
  return {
    name: "amh:cloudflare-headers",
    apply: "build",
    configResolved(config) {
      const value: unknown = config.env.VITE_SUPABASE_URL;
      supabaseUrl = typeof value === "string" && value !== "" ? value : undefined;
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: buildHeadersFile(supabaseUrl) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  // End-to-end builds (`--mode e2e`) never read a developer's .env files, so the smoke tests run the
  // same way everywhere: without a backend.
  envDir: mode === "e2e" ? false : undefined,
  plugins: [
    clientEnvGuard(),
    cloudflareHeaders(),
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
    VitePWA({
      // A new version waits until the user accepts it, so nobody loses half-typed work to an
      // automatic reload. The prompt is src/app/update-prompt.tsx.
      registerType: "prompt",
      injectRegister: false,
      // The icons are already matched by globPatterns below.
      includeManifestIcons: false,
      manifest: {
        id: "/",
        name: "আদর্শ মুন্সির হোটেল · অর্ডার ও বিলিং",
        short_name: "আদর্শ হোটেল",
        description: "Orders, deliveries and bills for Adarsha Munshir Hotel",
        lang: "bn",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#eef2f7",
        theme_color: "#eef2f7",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the app shell only. Supabase is on another origin, so its requests always go
        // to the network and data is never served stale from the service worker.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
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
  build: {
    // E2E builds go elsewhere so they never replace the production build in dist/.
    outDir: mode === "e2e" ? "dist-e2e" : "dist",
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
}));
