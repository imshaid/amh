# AMH Billing 2.0

Order, delivery and billing system for আদর্শ মুন্সির হোটেল (Adarsha Munshir Hotel), Thakurgaon.

- What to build and in which order: [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- Where we are: [docs/PROGRESS.md](docs/PROGRESS.md) · why things are as they are: [docs/DECISIONS.md](docs/DECISIONS.md) · schema design: [docs/data-model.md](docs/data-model.md)
- Working rules for Claude Code sessions: [CLAUDE.md](CLAUDE.md)

`docs/reference/samples/` contains real names and phone numbers. Keep this repository private.

## Requirements

- Node.js 22 (see `.nvmrc`) and npm
- Docker, for the local Supabase stack

## Getting started

```sh
npm install
npx playwright install chromium   # browser for the end-to-end tests
npm run db:start                  # local Supabase; the first run pulls the images
npm run db:env                    # writes apps/web/.env.local for the local stack
npm run dev                       # http://localhost:5173
```

The app also runs without Supabase; the live indicator in the top bar then says the server is not set up yet.

Every colour, type style and component is on one page at <http://localhost:5173/dev/gallery> (also in the command bar, Ctrl+K).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run check` | Everything CI runs: typecheck, lint, format, unit tests, build, bundle secret scan, end-to-end smoke tests |
| `npm run verify` | The fast part of `check`: typecheck, lint, format, unit tests |
| `npm run test`, `npm run test:watch` | Vitest |
| `npm run e2e` | Playwright smoke tests (desktop and phone) against a production build |
| `npm run db:start`, `db:stop`, `db:status`, `db:reset` | Local Supabase (Studio at <http://127.0.0.1:54423>) |
| `npm run db:env` | Point the web app at the running local Supabase |
| `npm run preview:pages -w @amh/web` | Serve `apps/web/dist` with Cloudflare's headers and routing |
| `npm run icons -w @amh/web` | Re-render the app icons from their SVG sources |

## Layout

```text
apps/web/            the app: React 19, TypeScript, Vite, TanStack Router and Query, Tailwind CSS v4, i18next
  src/routes/        file-based routes (src/routeTree.gen.ts is generated)
  src/app/           router, query client, navigation, app shell (sidebar, top bar, bottom bar, command bar)
  src/ui/            the design system: primitives on Radix, icons, motion (see /dev/gallery)
  src/styles/        tokens (colour, type, motion), fonts, and the contrast test that guards them
  src/dev/           developer pages: the design gallery
  src/i18n/          bn and en catalogues, formatting (Bangla digits, taka, dates)
  src/lib/           environment, Supabase client, theme, media and network hooks
  build/             build-time code (Cloudflare security headers)
  e2e/               Playwright smoke tests and axe accessibility checks
supabase/            local stack configuration; migrations and functions arrive in Segment 2
scripts/             repository scripts (bundle secret scan, local env)
docs/                blueprint, progress, decisions, data model, reference material
```

## Deployment

GitHub Actions (`.github/workflows/ci.yml`) runs the checks on every push. Once the repository has the `CLOUDFLARE_ACCOUNT_ID` variable and the `CLOUDFLARE_API_TOKEN` secret, it also deploys each pushed branch to a Cloudflare Pages preview. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as repository variables to connect previews to the hosted Supabase project.
