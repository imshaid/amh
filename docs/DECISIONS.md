# Decisions

One short entry per non-obvious choice: date, decision, why.

- 2026-10-19 — Fresh codebase and fresh Supabase project; legacy app stays live until cutover and serves only as a design/PDF reference.
- 2026-10-19 — Old package list and legacy history are not migrated; the system starts clean. The new list (`docs/reference/packages-new.xlsx`) is imported through the Packages screen.
- 2026-10-19 — Package names are the WV codes (e.g. `Lunch Basic-07`) so bills match POs; item lines follow the style in BLUEPRINT §2.
- 2026-10-19 — Git: branch per segment, Conventional Commits after each working unit, push every commit, merge + tag per segment.
- 2026-10-19 — Deduction at source is a per-client rate, default 16%, until the VAT/AIT split is verified.
- 2026-10-19 — Voice input is out of scope for now. The AI assistant is available to all three admins.
- 2026-10-19 — Project files moved from `amh-v2/` to the repository root and the older root `BLUEPRINT.md` removed: Claude Code loads `CLAUDE.md` only from where a session starts, and one blueprint avoids following stale rules.
- 2026-10-19 — npm workspaces: the SPA is `apps/web`; the PDF service and shared packages (e.g. document templates used by both the preview and the PDF renderer) join as further workspaces. npm, not pnpm, because it ships with Node.
- 2026-10-19 — TypeScript 6.0, not 7: typescript-eslint supports TypeScript < 6.1 only. Revisit when it supports 7.
- 2026-10-19 — ESLint 10 with `eslint-plugin-jsx-a11y-x`: ESLint 9 is out of support and `eslint-plugin-jsx-a11y` does not support ESLint 10.
- 2026-10-19 — Hard-coded UI text is a lint error: JSX text plus `aria-label`, `title`, `alt`, `placeholder` and `label` attributes must come from translations.
- 2026-10-19 — TanStack Router file routes with automatic code splitting. Signed-in screens live under a pathless `_app` layout; sign-in and delivery links will sit outside it. New order is `/new`, so the Orders menu item can match order pages without also matching it.
- 2026-10-19 — Bangla is the default regardless of browser language. Language and theme are stored per device for now (`amh:language`, `amh:theme`) and move to the user profile in Segment 2.
- 2026-10-19 — Theme follows the device unless the user picks light or dark. `public/theme-boot.js` applies the saved choice before first paint; it is an external file so the CSP can stay `script-src 'self'`.
- 2026-10-19 — Numbers use South Asian grouping in both languages (`bn-BD`, `en-IN`: ১,১১,৮৮০ / 1,11,880), as the prototype does. Money is formatted from exact decimal strings with a ৳ prefix and a true minus sign; the UI never calculates it.
- 2026-10-19 — Only allowlisted `VITE_` variables may reach the bundle (`src/lib/client-env-policy.ts`). The build fails on any other, and on a secret or service-role key passed as the publishable key; this must happen at build time because Vite has already inlined the value by run time. A post-build scan also checks `dist/` for secret formats and for build-time secret environment values.
- 2026-10-19 — The app starts without a backend configured and says the server is not set up yet, so UI work and previews do not depend on Supabase.
- 2026-10-19 — Local Supabase uses ports 544xx (API 54421, DB 54422, Studio 54423, Mailpit 54424) so it can run beside another local Supabase project; analytics is off to save memory.
- 2026-10-19 — PWA updates wait for the user (prompt mode) so nobody loses half-typed work; installed apps check hourly. Only the app shell is precached; Supabase responses are never cached by the service worker.
- 2026-10-19 — App icon follows the hotel's logo (white serif AMH in a blue oval), set in Tinos Bold as outlines and rendered by `apps/web/scripts/generate-icons.mjs` with Playwright's Chromium, so no image library is needed.
- 2026-10-19 — Cloudflare Pages deploys come from GitHub Actions (`wrangler pages deploy`), not Cloudflare's Git integration, so nothing deploys unless the checks pass. The Pages project's production branch is `production`, so every push, main included, is a preview until launch (Segment 14).
- 2026-10-19 — The build writes `_headers`: a CSP that allows only the app and the configured Supabase origin, standard hardening headers, and `noindex` on every deployment.
- 2026-10-19 — E2E smoke tests run against a production build made with `--mode e2e`, which reads no `.env` files and goes to `dist-e2e/`, so the tests never depend on a backend and never replace the deployable `dist/`.
- 2026-10-19 — Test fixtures never use real-format keys, not even the CLI's well-known local ones; GitHub push protection rejects them.
