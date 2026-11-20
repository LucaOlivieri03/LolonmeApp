# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Admin (also a Player):** Runs the LOLONMEBOL league day to day — registers players by email, imports `LOLONMEBOL.xlsx`, edits the Cup bracket across all rounds, closes MVP/rating votes (with override authority), moderates the blog/media, and exclusively manages the prize pool (`Pozo`).
- **Authorized Players (`Jugadores Autorizados`):** Trusted league members delegated by the Admin to enter/edit weekly matches and performances and maintain the announcements board and event calendar.
- **Players (`Jugadores`):** Friends competing in weekly `F5`/`F6`/`F7` matches who check standings, Cup ties, personal/group stats, vote for MVP and ratings on matches they played, post in the global blog, pick a favorite football club, and upload match photos.
- **Guests (`Invitados`):** Friends or visitors without an account who read standings, Cup brackets, calendar, player profiles/stats, and the blog in read-only mode.

## Product Purpose

**LolonmeApp** is the official mobile-first digital hub (installable PWA) for the **LOLONMEBOL** amateur football tournament. It replaces manual spreadsheet distribution with a live, transparent home for annual and historical standings, automatic yet manually editable Cup brackets, post-match MVP/rating voting, advanced teammate/rival analytics, and league operations — while maintaining `$0/month` infrastructure costs and continuous backwards compatibility with `LOLONMEBOL.xlsx`.

Success means players can check tables, brackets, stats, and vote effortlessly on their phones right after a match, while the Admin and Authorized Players can record matchdays and manage the season without friction or recurring hosting fees.

## Positioning

Purpose-built around LOLONMEBOL's exact tournament rules rather than generic league software:
- Rotating weekly teams with individual League points (`3/1/0`), boosted Cup teammate points (`4/2/0`) to reward attendance while Cup captains earn `0 pts / 0 PJ` in League standings, strict 6-step tiebreakers (plus a mandatory 1st-place tiebreaker match), and a 9-player mid-year Cup qualification system with previous-finalist auto-bids and manual bracket editing.
- Group analytics tailored to rotating-team pickup football: **Química (%)** (win rate together, plus optional `3/1/0` effectiveness toggle), **Consistencia (`CT%`)** (80% Wilson lower bound), and **Historial (`V − D`)** as rivals, filterable by season and modality (`F5`/`F6`/`F7`).
- Continuous, non-destructive Excel synchronization (`LOLONMEBOL.xlsx`) with name/emoji normalization and pre-commit diff preview.

## Operating Context

- **Primary usage scene:** Fast, one-handed mobile use right after weekly matches (at the pitch or post-match gathering) for checking standings, entering results, and voting.
- **Season cadence:** Annual seasons (`2025`, `2026`, `2027+`) consisting of weekly **Liga Anual** dates, mid-year **Copa Anual** (two-legged 1v1 captain ties: `Fase Previa → Cuartos → Semis → Final`), end-of-year **Final LOLONMEBOL** (League champion vs. Cup champion), and **Fechas Especiales** (`F11 Aniversario`, `F11 Oktubre`, `F11 Despedida`, rest/postponed dates).
- **Spreadsheet continuity:** Historical and ongoing records originate from `docs/LOLONMEBOL.xlsx`; Admin re-imports updates with preview diffs.
- **Phased roadmap:**
  - *Phase 1 (MVP Core):* Auth + roles, official branding, Excel importer, Main Page (announcements, calendar, annual/historical standings, editable Cup bracket), match/performance entry, special dates, player hub, Química/Consistencia/Historial, and Admin-only Pozo.
  - *Phase 2:* Participant-only transparent MVP/rating voting, global topic blog, favorite club integration (API-Football cached in Supabase), and match photo galleries (5–15 photos via Cloudinary).
  - *Phase 3:* Short match video clips (Cloudflare R2 / unlisted YouTube), attendance RSVP ("Voy / No voy"), and team-builder assistant.

## Capabilities and Constraints

- **Zero-cost infrastructure constraint:** Must stay within `$0/month` free tiers (Vercel Hobby, Supabase Free with weekly keep-alive cron, Cloudinary Free for Phase 2 photos, Cloudflare R2 / YouTube for Phase 3 clips, API-Football Free cached in Supabase) with no Play Store / App Store distribution (PWA installable on Android/iOS).
- **Strict role permissions:** `Pozo` (monthly configurable fees, expenses/prizes, yields, balance), Excel import, player management, Cup bracket editing, and MVP closing/override are strictly Admin-only. Authorized Players can edit matches/performances, announcements, and calendar. Only match participants can vote on that match's MVP and ratings; once closed, full vote breakdown is transparent to everyone.
- **Official domain terminology (Spanish UI, `lang="es"`):** `LOLONMEBOL`, `Liga`, `Copa`, `Final LOLONMEBOL`, `Fechas Especiales`, `Pozo`, `Química`, `Consistencia (CT%)`, `Historial (V − D)`, `Estrellas (⭐)` (1 star per official Liga, Copa, or Final LOLONMEBOL title), `F5`/`F6`/`F7`/`F11`.
- **Configurable exceptions:** Special dates do not count toward Liga standings except configurable historical exceptions (e.g., `F11 Aniversario 2025`). Cup ties support manual Admin overrides for injury withdrawals and replacements.

## Brand Commitments

- **Name:** **LolonmeApp** for **LOLONMEBOL**.
- **Language & Voice:** Spanish (`es`). Official football-federation energy with tongue-in-cheek football banter — CONMEBOL-style seriousness applied to a friends' league.
- **Official Assets (binding):**
  - Primary emblem: `assets/LogoLOLONMEBOL.svg` (served at `public/assets/LogoLOLONMEBOL.svg`)
  - Secondary mark: `assets/Logo.svg` (served at `public/assets/Logo.svg`)
  - Tournament anthem: `assets/cancion.mpeg` (served at `public/assets/cancion.mpeg`, played via `AnthemPlayer`)

## Evidence on Hand

- `docs/documentacion_negocio_lolonmebol.md` — Definitive business and product scope (v2).
- `docs/reglas_torneo_lolonmebol.md` — President-validated official rules and calculation formulas (v3).
- `docs/plan_tecnico_lolonmebol.md` — Technical architecture plan.
- `docs/LOLONMEBOL.xlsx` & `src/lib/data/seed-data.json` — Real historical 2025/2026 tournament dataset.
- `assets/LogoLOLONMEBOL.svg`, `assets/Logo.svg`, `assets/cancion.mpeg` — Official brand logos and anthem.
- **Absences not to fabricate:** Do not invent player testimonials, external press, paid pricing tiers, or fictional match/player statistics beyond `seed-data.json` and `LOLONMEBOL.xlsx`.

## Product Principles

1. **One-handed pitch-side speed:** Every primary flow (checking standings/Cup, recording a match, casting a vote) must work cleanly with one thumb on a phone right after full time.
2. **Rules are sacred, Admin has final say:** Automated calculations (points, tiebreakers, Wilson consistency, Cup seeding) follow the official v3 rules verbatim, while the Admin retains explicit manual override for real-world league exceptions (injuries, MVP overrides, special-date flags).
3. **Federation gravitas, friends'-league soul:** Present the tournament with official-competition clarity and seriousness, paired with warm, tongue-in-cheek football banter — never sterile enterprise copy.
4. **Radical transparency where it counts, strict privacy where it matters:** Standings, stats, and closed MVP/rating vote breakdowns are open and verifiable; `Pozo` finances and operational controls stay strictly scoped by role.
5. **Zero-cost durability:** Architectural and media choices must preserve `$0/month` operation and seamless continuity with `LOLONMEBOL.xlsx`.

## Accessibility & Inclusion

- Prioritize fast, one-handed mobile ergonomics (comfortable touch targets, readable compact data tables on small screens) for post-match phone use.
- Preserve public read-only guest access without login friction for main tournament views.
