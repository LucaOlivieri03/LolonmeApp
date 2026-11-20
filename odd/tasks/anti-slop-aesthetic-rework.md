# Feature: Anti-Slop Aesthetic Rework (Boletín Oficial de Federación + Pitch Geometry)
Branch: `feat/fase-1-mvp`
Status: Completed

## Specs
- S1: "Analiza todo el sistema, queiro un rework total de la estética para hacerla anti slop."
- S2: Scope: "Todo el sistema junto: shell, tokens y las 6 rutas (/, /partidos, /stats, /calendario, /blog, /admin)"
- S3: Luminosity: "Modo claro principal (alto contraste, lectura rápida en cancha o de día/noche) con acentos fuertes de torneo"
- S4: Anti-reference: "Que parezca un SaaS corporativo o dashboard genérico de IA"
- S5: Direction: "Opcion A, pero que tenga estética referencial al campo de juego o el futbol en general. (Luego va a haber una vista, la de partido, donde se va a mostrar la formación, esa tiene que ser tal cual un campo de juego, pero queda para despues eso)"
- S6: Preserve all functional invariants: `useTournament()` context and `localStorage` keys, role/auth gating, domain engine calculations (`computeStandings`, `getCupTieAggregate`, `resolveCupTieWinner`, `computePairwiseStats`, `computeSubgroupStats`, `computeFundSummary`), Excel import dry-run/apply pipeline, `AnthemPlayer` chorus/full playback, PWA manifest/SW, and all 6 routes.

## Tasks
- [x] T1 (S1, S2, S3, S5): Design tokens, typography (`Archivo` + `Barlow Condensed`), browser surface theming, pitch-line geometry utilities, formatting helpers, and responsive shell (`layout.tsx`, `globals.css`, `AppHeader`, `BottomNav`, `AnthemPlayer`, `Logo.svg` usage) — Route: inline — Commit: pending
- [x] T2 (S1, S2, S3, S4, S5, S6): Rework Home (`/`) + `StandingsTable` (above-the-fold standings, sticky player column, clean cup zone indicator without one-sided rounded bars) + `CupBracketView` (true horizontal progression bracket with SVG connectors & Final LOLONMEBOL prominence) — Route: inline — Commit: pending
- [x] T3 (S1, S2, S3, S4, S5, S6): Rework `/partidos`, `/calendario`, and `/blog` (pitch-line matchday sheets, human-formatted Spanish dates, missing `league_tiebreaker` filter, clear empty states, one-handed touch targets) — Route: inline — Commit: pending
- [x] T4 (S1, S2, S3, S4, S5, S6): Rework `/stats` (unified filter bar, `recharts` visualizations for Química/Wilson CT% and H2H `V − D`, clean profile & lab views, proper empty states) — Route: inline — Commit: pending
- [x] T5 (S1, S2, S3, S4, S5, S6): Rework `/admin`, `AdminCupTab`, `AdminPozoTab`, `AdminExcelTab` (unified federation form controls >=16px, searchable player pickers instead of silent 28/24 slices, sticky Pozo column with 44px touch targets, safe two-step delete confirmations) — Route: inline — Commit: pending
- [x] T6 (S1, S2, S5, S6): Verify (`pnpm typecheck`, `pnpm test`, `pnpm build`) + visual/browser inspection & finish review + generate `DESIGN.md` and `.impeccable/design.json` — Route: inline + browser verification — Commit: pending

## Log
- L1: User requested: "Analiza todo el sistema, queiro un rework total de la estética para hacerla anti slop."
- L2: User confirmed scope ("Todo el sistema junto: shell, tokens y las 6 rutas"), luminosity ("Modo claro principal (alto contraste, lectura rápida en cancha o de día/noche) con acentos fuertes de torneo"), and anti-reference ("Que parezca un SaaS corporativo o dashboard genérico de IA").
- L3: User selected Direction A ("Boletín Oficial de Federación") with football/pitch-field visual references, noting that a dedicated pitch-formation match view will be built in a future iteration.
