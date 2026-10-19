# Decisions

One short entry per non-obvious choice: date, decision, why.

- 2026-10-19 — Fresh codebase and fresh Supabase project; legacy app stays live until cutover and serves only as a design/PDF reference.
- 2026-10-19 — Old package list and legacy history are not migrated; the system starts clean. The new list (`docs/reference/packages-new.xlsx`) is imported through the Packages screen.
- 2026-10-19 — Package names are the WV codes (e.g. `Lunch Basic-07`) so bills match POs; item lines follow the style in BLUEPRINT §2.
- 2026-10-19 — Git: branch per segment, Conventional Commits after each working unit, push every commit, merge + tag per segment.
- 2026-10-19 — Deduction at source is a per-client rate, default 16%, until the VAT/AIT split is verified.
- 2026-10-19 — Voice input is out of scope for now. The AI assistant is available to all three admins.
