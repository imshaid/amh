# AMH Billing 2.0 — Blueprint

The single source of truth for what we are building and in what order. It records decisions already made with the owner. Where it is silent, use your own engineering judgement and write the decision down in `docs/DECISIONS.md`.

Visual reference: `docs/reference/demo.html` (open it in a browser). It is the approved clickable prototype. Match its information architecture, flows and visual direction; improve on its details freely. It uses sample data only.

---

## 1. The business

**আদর্শ মুন্সির হোটেল** (Adarsha Munshir Hotel), Thakurgaon Road, Thakurgaon, Bangladesh.
Proprietor: মোঃ জিয়াউর রহমান (জিয়া). Phones: ০১৭১৫-২০৪২২৪, ০১৯৩৭-৫৮১২৯৮.

This system covers the **order and catering** side only: organisations order food packages (snacks, lunch, iftar, single items) for many delivery locations, the hotel delivers, then bills.

- **Main clients:** World Vision Bangladesh, through two units that are billed separately: **Thakurgaon AP** and **REACTS-IN Project**. Occasional other clients exist.
- **Volume:** 4–10 orders a month, totalling 400–1000 location deliveries a month.
- **One challan per location per day.** A monthly schedule with 25 locations over 6 days means about 150 challans for one order.
- **One bill per order** (the full gross amount), plus one **summary** page and a **Bangla datasheet** for the delivery boys.
- **Payment:** the client pays 1–2 months later by bank EFT into one bank account, net of tax deducted at source. Today this is treated as a flat **16%**: a ৳100 bill arrives as ৳84. The exact VAT/AIT split is not yet verified, so the rate must be a per-client setting, defaulting to 16%, and changeable later without code changes.
- **Users:** three admins with equal rights: the owner's son (main operator, developer) and his parents. They use phones and PCs equally. The parents are not technical.
- **Orders arrive in many forms:** WV monthly Excel food schedules, PDF schedules, WV Purchase Orders (PDF or photo), handwritten notes, phone calls.

Real samples are in `docs/reference/samples/` (see its README). Treat them as the ground truth for formats and as test fixtures. They contain real names and phone numbers, so keep the repository private.

## 2. Product principles

1. **Data first, paper second.** The user works with orders, locations and quantities. Bills, challans, summaries and datasheets are generated from that data. Two ways to enter it, both on the same data model:
   - **Schedule mode:** a grid of rows (date × location × package quantities), usually imported.
   - **Page editor mode:** the old system's page-by-page fill-up. You type directly onto A4 bill/challan pages.
2. **Documents look exactly like today.** The printed bill, challan and summary keep the current design pixel for pixel (see §6). Everything around them is new.
3. **Packages are known by price.** Staff and clients say "৫২০ টাকার লাঞ্চ" or write column headers like `Lunch-430`. Typing a price must find the package everywhere. When two packages share a price, the system asks, never guesses.
4. **Snapshot policy.** A line on an order copies the package's name, items and rate at that moment. Later edits to a package never change existing orders or documents.
5. **Issued means locked.** Once a bill is issued its documents are immutable. A change creates a revision; the original stays in history.
6. **The system checks, the human confirms.** Imports, AI reads and bank-SMS matches produce drafts and highlight what they fixed or doubt. Nothing is committed without a confirm.
7. **Money is computed in one place.** All money math happens on the server/database with exact decimals (2 places). The UI and the AI never compute persisted totals themselves.
8. **Live by default.** Every change appears on every open device without refresh.
9. **Bilingual UI.** A বাংলা/English toggle per user. Bangla is the default. All UI copy lives in translation files, never hard-coded in components. Bangla digits are shown in Bangla mode. Copy is natural, everyday Bangla, not stiff translation.

**Packages:** the old package list is **not** carried over. The owner will provide a new list, to be imported through the Packages screen (Excel import). Until then seed nothing in production; tests use fixtures.

## 3. Stack (decided)

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite SPA, installable PWA |
| Routing / data | TanStack Router, TanStack Query, TanStack Table (+ virtualisation for long lists/grids) |
| Styling / UI | Tailwind CSS v4 with our own design tokens; shadcn/ui-style primitives (Radix) restyled to our system |
| Forms / validation | react-hook-form + zod (shared schemas where possible) |
| i18n | i18next (bn default, en) |
| Motion | Motion (the Framer Motion successor) |
| Charts | Your choice, as long as it meets §7 |
| Backend | Supabase: Postgres (+ RLS), Auth, Realtime, Storage, Edge Functions |
| PDF | The existing Node + Playwright service idea (persistent Chromium, chunked render, pdf-lib merge), rebuilt to render **from data**, not from a copy of the screen DOM. Deployed on Google Cloud Run. |
| AI | Google Gemini (AI Studio API) with function calling, called **only** from Edge Functions. Model name is configuration, not code. |
| Hosting | Cloudflare Pages (frontend), Supabase, Cloud Run (PDF) |
| Tests | Vitest for logic, Playwright for end-to-end smoke tests |

This is a fresh codebase with a fresh Supabase project. The legacy app (`github.com/imshaid/amh-billing`, live at amh-billing.pages.dev) keeps running until cutover. Use it only as a reference for the document design and PDF lessons (§6).

## 4. Domain model

Names are indicative; design the actual schema yourself and document it in `docs/data-model.md`.

- **Business settings:** hotel names (bn/en), proprietor, tagline, address, phones, logo and header artwork, fiscal year (July–June), number formats. The document header reads these settings instead of hard-coded strings.
- **Users / profiles:** three admins, equal permissions, preferred language and theme.
- **Organisation → Project (client):** e.g. World Vision Bangladesh → Thakurgaon AP / REACTS-IN Project. A project has a billing buyer name, billing address, deduction rate (default 16%) and notes.
- **Locations:** English name (as clients write it), Bangla name (for datasheets), union/area, and learned **aliases** (spelling variants seen in imports, e.g. `Darapra` → `Darapara LR`).
- **Contacts (facilitators):** names (en/bn), normalised phone numbers (`01XXXXXXXXX`), linked to locations/projects.
- **Log codes:** code + activity name (e.g. `132.01.08` — Impact+ session), per project.
- **Package categories and packages:** name, category, rate, items (each with English text, printed on documents, and optional Bangla text, shown in the UI), optional client-side codes (WV PO names such as `Lunch Basic-07` or `ADORSHA_HOTEL_PACKAGE_14_SNACKS_BASIC_3`), active flag, and rate history with effective dates.
- **Orders:** number, project, title, PO number and internal ref, source (excel / pdf / photo / phone / manual), status (`draft → confirmed → delivering → billed → partially paid → paid`, plus `cancelled`), date range, attached source files.
- **Order lines:** the package snapshot (name, items, rate) used by this order. Each line has a **bill quantity**: by default the sum of its challan quantities; in page-editor mode it can be typed directly. The difference is shown, never hidden.
- **Challans (deliveries):** one per date × location. Header fields: date, time, location, log code/activity, contact, and editable printed buyer/address text. Per-line quantities. Flags: delivered (from the delivery link) and signed copy returned (optional photo).
- **Bill:** one per order, numbered on issue, locked after issue, with revisions linked to the original.
- **Summary:** derived per package from the challans. Only its header fields are stored.
- **Issued documents:** the generated PDF for every issued document, stored in Storage with a content hash.
- **Payments:** date, amount received, method (bank EFT / cash / other), bank reference, raw SMS text, and allocations to one or more bills including the deduction amount.
- **Audit log:** actor, channel (`ui` / `ai` / `system`), action, entity, before/after, time. AI actions can be undone from here.
- **Import profiles:** remembered column-header → package mappings per project, so next month's file maps itself.
- **Delivery links:** tokenised no-login links scoped to one order + date (+ optional route/union), with an expiry.

**Numbering:** per fiscal year, atomic, never reused, generated in Postgres. Examples: order `AMH/26-27/0047`, bill `AMH/26-27/B-0047`. Challans get a stable short number per order.

**Money:** `expected_net = gross × (1 − deduction_rate)`. A payment can cover several bills. Show the difference between expected and received.

## 5. Features

Bangla labels in brackets match the prototype.

### 5.1 App shell
- Desktop: left sidebar (Work: Dashboard, Orders, New order, Receivables; Directory: Clients, Locations, Packages), a sticky top bar with search/command bar (`Ctrl+K`), live indicator, language toggle and theme toggle.
- Phone: bottom bar (Home, Orders, a centre **+ New** button, Receivables, More). Tables become cards. Editing on A4 pages opens a large field sheet.
- Light and dark themes, both designed, not inverted.

### 5.2 Dashboard (ড্যাশবোর্ড)
- Hero figure: **money waiting to be paid, as expected net**, with gross, bill count and oldest age.
- KPI tiles with sparklines: billed this month vs last, received this month, this month's challans delivered (meter).
- Charts: monthly billed vs received (12 months, full months only), receivables by age (0–30 / 31–60 / 61–90 / 90+), top packages by billed amount, client share.
- Today & upcoming deliveries, with a datasheet shortcut and live delivered progress.
- Realtime activity feed (who did what), new items highlighted briefly.

### 5.3 Orders (অর্ডার)
- List with status chips, counts, search (number, client, month), and source and age hints.
- Order page: header (number, client, title, status pill, progress steps Order → Delivery → Bill → Payment), key figures (gross, deduction, expected net, signed challans back), tabs:
  - **Schedule:** the row grid with day filter, per-package price columns and totals. Editable while in draft. Keyboard-friendly, fast for 200+ rows. Supports typing a price to pick a package, `10+2` meaning 12, and location/contact autocomplete.
  - **Challans:** list with signed-returned checkboxes and progress, live A4 preview, "all as one PDF".
  - **Bill:** A4 preview, lock state, deduction panel (never printed), issue / revise / PDF.
  - **Datasheet:** see 5.6.
  - **History:** the order's audit trail.
- **Page editor mode** (the old system, see prototype order 047):
  - Pages stacked as real A4 documents, with zoom (fit / 75% / 100%) and page chips to jump between them.
  - Type directly into the buyer, address, date, log code/serial, quantity and rate fields. Amount, total and amount-in-words update live.
  - Packages are added on the bill page (search by price or name) and appear on every challan and the summary. Clicking a package name lets you change it or remove the row everywhere.
  - Under each page: + Challan, + Summary (one only), Duplicate (challans), Delete (inline second-press confirm). Only one bill per order.
  - **Check panel:** per package, bill quantity vs the sum of challans, plus a missing-quantity flag. Totals: gross, deduction, expected net. Issue & lock warns on mismatch and needs a second confirm.
  - Autosave indicator. On phones, a tap opens a field sheet.
- **Issue & lock:** assigns the bill number, renders and stores the PDFs, locks everything. **Revise** creates a new draft revision linked to the original.

### 5.4 New order / intake (নতুন অর্ডার)
Four sources, all ending in a draft the user reviews:
1. **Excel / CSV:** parse WV food schedules (see the samples), including:
   - Package columns are recognised from the **price in the header**. Expect headers like `Snack 50`, `Snakc 85`, `Lunch-430`, `B. Snacks 3\n100`, `Biscuit 20`.
   - Remember mappings per project. Ask when a price is shared.
   - Fix flipped dates (`2026-07-09` that means 7 September; use the file title/month to decide) and text dates (`13/9/26`).
   - Restore phone numbers that lost their leading zero (`1638387433.0` → `01638387433`).
   - Match locations by name and alias. Propose a Bangla name for new ones.
   - Ignore total and summary blocks. Handle multiple sheets.
   - Show a review screen: column mapping, a list of automatic fixes, flagged cells, and a preview grid.
2. **PDF / photo (AI):** WV POs and PDF schedules are read by Gemini into the same draft structure. Lines are matched to packages by price, then name or code. Unknown rates are flagged, with a choice to create a package at the PO rate.
3. **Quick entry:** price → package, quantity (`10+2`), location autocomplete; rows accumulate into a draft order.
4. **Page by page:** pick a client and title, and a blank bill page opens in the page editor.
The original file is always attached to the order.

### 5.5 Receivables & payments (পাওনা ও পেমেন্ট)
- **Bank SMS matching:** paste the SMS and the system parses amount, date and reference, then finds the bill by PO number (the SMS writes `PBD2778470`; POs are written `PBD-2794325`, so normalise). It shows gross, deduction, expected and received, plus any difference, before **Record payment**. It also supports manual payment entry and splitting one payment across several bills.
- Receivables-by-age chart, unpaid bills table (days outstanding, expected net), recent payments.
- Per-client average days to pay.

### 5.6 Datasheet & delivery
- **Bangla datasheet** for delivery boys, in the same format as the samples (`8_August`, `11_July`):
  - Day blocks headed `১০/০৮/২০২৬ - সোমবার`.
  - Inside each day, groups by price with a vertical label (`৫০৳`).
  - Each row: quantity, Bangla location, contact, phone. Group totals.
  - Two-column printable layout.
  - Optional split by union/route.
- **Kitchen sheet:** per day, total count per package.
- **Delivery link:** a no-login phone page for one day and route. It lists stops with quantities and a copyable phone number, plus a **Mark delivered** button that updates the dashboard live.

### 5.7 Directories
- **Clients:** organisation/project cards with billed this fiscal year, unpaid, average days to pay and deduction rate.
- **Locations:** English and Bangla names, union, aliases, delivery count; search; add/edit.
- **Contacts:** add/edit, phone normalisation.
- **Packages & prices:** price-first cards, category filter, search by price, duplicate-price badge, add/edit, rate history, **Excel import for the new list**.

### 5.8 AI assistant (for all three users; no voice for now)
- Lives in the `Ctrl+K` command bar and a side panel (desktop), and behind a button on phones. It knows the current page context (e.g. the open order).
- **Does things only through typed tools**: the same server functions the UI uses (create order, add challans, update quantities, change a package rate for future orders, generate a datasheet, etc.). No raw SQL.
- **Answers questions** through read-only query tools (receivables, top packages, payment speed, etc.).
- **Never computes money itself.** Totals come from the server.
- **Preview → confirm:** every write shows a preview of the exact changes first. Ambiguity, such as a shared price or an unknown location, becomes a question, not a guess.
- **Hard limits:** issuing/locking bills, deleting orders or pages, and recording payments are only proposed. The user presses the real button.
- Every AI action is logged with channel `ai` and can be undone as one unit.
- The API key stays server-side. Rate-limit per user. The model is configurable.

### 5.9 Settings & safety
- Business header info, number formats, fiscal year, per-client deduction rates, users and invitations, language/theme defaults.
- Audit log viewer with filters.
- Weekly automatic export backup (Excel/JSON) to Storage, plus manual export.
- Login suited to non-technical parents (e.g. phone number + PIN, mapped to Supabase Auth). Long sessions on trusted devices. RLS: only the three members can read or write anything. Delivery links can read only their own scope.

## 6. Documents — keep the current design

Port the look exactly from the legacy repo:

- `frontend/src/features/shared/DocumentHeader.jsx` + `.module.css` (banner bar, AMH logo, goat/chicken/fish art, scaled hotel name with outline, proprietor badge, tagline, address/phones, meta box with dotted value lines)
- `frontend/src/features/bill/BillPage.jsx` + `.module.css`, `features/invoice/InvoicePage.jsx` (challan), summary page
- `frontend/src/assets/images/*`, `frontend/src/domain/numberToWords.js` ("Sixty nine thousand two hundred seventy only")
- Fonts: Noto Serif Bengali for document Bangla, a Times-like serif (Tinos/Liberation Serif) for English.

Brand blue `#285AA0`, outline `#DAE3F3`.

Table columns: Bill — SL, Package, Items, Quantity, Rate, Amount + Total in words; Challan & Summary — SL, Package, Items, Quantity. Right field: bill "ক্রমিক", challan/summary "Log Code". Footer: Receiver's Signature / Proprietor's Signature.

Lessons from the legacy PDF service that must carry over:

- Sub-1px table borders are drawn with `box-shadow`, because Chromium's PDF path clamps `border` to 1px.
- The hotel-name outline uses stacked `text-shadow`, not `-webkit-text-stroke`.
- Bangla filenames need the RFC 5987 `filename*=` header.
- Use one persistent browser, load HTML from temporary files, render in chunks, and merge with pdf-lib.
- Templates are rendered **from data on the server** so that 1000-page batches work and print output never depends on what is on screen.
- Use embedded web fonts only.

## 7. Design direction — world-class, not AI-generic

The prototype sets the direction. Keep its tokens as the starting point and refine them.

- **Identity:** the hotel's own logo blue as the brand; a warm turmeric accent for "in progress/delivery"; cool, slightly blue-tinted neutrals. Semantic status colours are separate from the brand (good/warning/serious/critical) and always paired with an icon or label.
- **Type:** Anek Bangla for headings and figures (with its width axis), Hind Siliguri for body, IBM Plex Mono for codes and numbers like PO/log codes. Tabular numerals in every column of figures. A real type scale.
- **Signature details that only this business has:**
  - Prices as the hero of package cards.
  - The ৳ sign with Bangla digits.
  - The A4 documents themselves shown as paper on a tinted canvas.
  - The bank-SMS preview styled like a feature-phone screen.
  - The datasheet in its real printed form.
- **Status in form:** pills, progress steps, meters and flash highlights, so what needs attention is visible at a glance.
- **Motion with purpose:**
  - Route transitions (short fade/rise) with skeletons instead of spinners.
  - Staggered entry of cards.
  - Count-up hero figures; chart lines that draw in and bars that grow from the baseline.
  - A sliding tab indicator; toasts with progress for long jobs (PDF batches).
  - A brief highlight on realtime changes.
  - Keep it to roughly 120–400 ms with ease-out curves, and respect `prefers-reduced-motion`.
  - No looping decoration.
- **Charts:**
  - Validate the categorical palette for colour-blind separation in both themes.
  - Never use dual axes.
  - Use thin marks with rounded data-ends, hairline solid gridlines and a 2px line weight.
  - Add a hover/tap tooltip with crosshair on line charts.
  - Show a legend for two or more series and direct labels used sparingly.
  - Text never uses series colours.
  - Each chart gets its own dark-mode steps.
  - Don't plot a partial current month as if it were a full one.
- **Avoid the generated look:**
  - No purple-blue gradients, no cream-and-terracotta, no acid-green-on-black.
  - No emoji as icons, no Inter-everywhere.
  - No identical rounded shadowed cards for every block, and no oversized hero.
  - No centred everything, no decorative numbered "01/02/03".
  - Use one consistent icon set (stroke icons).
  - Cards and borders are applied by role, not by default.
- **Empty, loading and error states** are designed for every screen, with copy that says what happened and what to do.
- **Accessibility:** visible focus, keyboard paths (command bar, grid navigation), AA contrast, large touch targets on phones.

## 8. Quality bar

- TypeScript strict, ESLint and Prettier clean, no `any` without a reason.
- Unit tests for every parser and money function:
  - Excel import, using the real samples as fixtures
  - SMS parser
  - `10+2`
  - date and phone fixes
  - numbering
  - deduction and allocation math
  - amount in words
- Playwright smoke tests for the main flows: import → order → challans → issue → payment match.
- Performance: an order with 300 rows and 300 challans stays smooth; PDF batches of 1000 pages succeed.
- Code and code comments in English only. All user-facing copy in `bn` and `en` translation files.

## 9. Segments

Work in segments sized for one Claude Code session. **Do one segment per session, then stop.** Each segment ends in a working, committed state with `docs/PROGRESS.md` updated. If a segment proves too large, split it at a natural boundary, finish the first half properly, and record the split in PROGRESS.

| # | Segment | Done when |
|---|---|---|
| 0 | **Foundation** — repo scaffold, tooling (TS strict, lint, format, Vitest, Playwright), Tailwind v4 + tokens skeleton, i18n wiring, routing shell, Supabase project link + local dev, env handling, PWA basics, Cloudflare Pages preview deploy, `docs/DECISIONS.md` and `docs/data-model.md` started | App runs locally and on a preview URL; CI-style check script passes |
| 1 | **Design system & shell** — full tokens (light/dark), fonts, icon set, primitives (button, input, select, chip, status pill, card, tabs with animated indicator, dialog, bottom sheet, toast with progress, skeleton, empty state, data table, KPI tile, meter, sparkline, progress steps), motion primitives, app shell (sidebar, top bar, bottom bar, command-bar shell, theme + language toggles), a `/dev/gallery` route | **Owner reviews the look in the browser before continuing** |
| 2 | **Database, auth, security** — schema and migrations for §4, RLS, numbering functions, money functions, audit trigger, generated types, parent-friendly login, seed business settings (no packages) | Migrations apply cleanly; RLS and function tests pass |
| 3 | **Directories** — clients/projects, locations (aliases), contacts, log codes, package categories and packages with rate history and **Excel import of the new list** | All directories usable on phone and desktop |
| 4 | **Orders & schedule** — order list, create, order page shell with tabs and progress steps, schedule grid (price-to-package, `10+2`, autocomplete, day filter, totals), automatic challans per date × location | A realistic order with ~150 challans can be built by hand |
| 5 | **Documents** — bill, challan and summary templates ported exactly (§6), A4 preview component, signed-returned tracking, issue & lock, revisions | Previews match the legacy PDFs side by side |
| 6 | **Page editor** — page-by-page mode on the same model, check panel, autosave, phone field sheets, intake card "page by page" | Prototype order 047's flow works end to end |
| 7 | **PDF service** — data-driven server rendering, chunked batches, Storage of issued PDFs, Bangla filenames, wire up all PDF buttons | 300 challans + bill + summary as one PDF; output matches legacy |
| 8 | **Datasheet & delivery** — Bangla datasheet (screen + PDF, route split), kitchen sheet, tokenised delivery link with mark-delivered and realtime | Datasheet matches the samples' layout |
| 9 | **Excel import** — full import pipeline and review screen per §5.4, mapping memory, all automatic fixes, fixtures from samples | Both sample schedules import correctly with the expected fixes listed |
| 10 | **Payments & receivables** — SMS parser, matching, allocations, deduction, manual entry, receivables screen and charts | The sample SMS format matches an issued bill end to end |
| 11 | **Dashboard & reports** — every dashboard element in §5.2 with realtime, reports (monthly, by client, by package, receivables) with Excel/PDF export | Dashboard live-updates when another device changes data |
| 12 | **AI intake** — PO/PDF/photo → draft via Edge Function + Gemini, review screen, unknown-rate handling | The sample PO and PDF schedule produce correct drafts |
| 13 | **AI assistant** — tool layer over existing server functions, command bar + side panel, preview/confirm, undo, audit channel `ai`, read-only query tools, rate limits | The prototype example prompts work with preview and undo |
| 14 | **Settings, polish & launch** — settings screens, audit viewer, backups, empty/error states sweep, accessibility and performance pass, e2e suite, production deploy, cutover checklist | Owner signs off; the legacy app can be retired |

**Later (not now):** legacy history import as a read-only archive (owner to decide); expenses & profit per order; restaurant point-of-sale; voice input; Telegram daily summary.

## 10. Open items (do not block)

- New package list file: expected at `docs/reference/samples/packages-new.xlsx` (or similar) before Segment 3 finishes. If absent, ship the import UI and seed nothing.
- Exact VAT/AIT composition of the deduction: keep the configurable rate; the owner will verify.
- Whether to import legacy history: decide before Segment 14.
