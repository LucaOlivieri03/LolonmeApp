# Mobile UI Overhaul (Impeccable Critique Follow-up)
Branch: `feat/wu7-pozo-excel-and-provider-removal`
Status: completed

## Specs
- S1: Fix global mobile shell (`AppHeader`, `AnthemPlayer`, `BottomNav`, `layout.tsx`) — zero horizontal overflow at `390px`, remove duplicate mobile `Reglas` link and dead `xs:inline` class, collapse `AnthemPlayer` to single `40×40` Play/Pause button on `< sm`, reduce `BottomNav` to 5 items (`Inicio`, `Partidos`, `Stats`, `Calendario`, `Reglas`) removing Phase 2 `/blog` placeholder from thumb bar, and add safe-area bottom padding.
- S2: Overhaul Home (`/`) above-the-fold hierarchy — keep the black chalkboard (`tactical-chalkboard`) aesthetic ABOVE `HomeCompetitionTabs`, refactored into a compact announcements carousel (1 announcement at a time with prev/next + dot indicators so standings rise above the fold on `390×844`), hide redundant `Accesos de Fecha` on mobile (`hidden md:flex`), add opaque sticky background on row `#1` and horizontal scroll cue on `StandingsTable`.
- S3: Adapt `/calendario` and `CupBracketView` for mobile — default `/calendario` to `Agenda` on mobile (`< 640px`), render compact dot-only cells in mobile `Mes` grid (no `"Co..."`/`"Li..."` truncation), place detail panel below grid with scroll-into-view and `Escape` dismiss, fix `<select>` vertical alignment and last-row border, pass `?date=...` on `"Ver planilla"`, and remove dead vertical space in `CupBracketView` on mobile with clean round navigation.
- S4: Distill `/partidos`, `/stats`, and `/reglas` for mobile — collapsible `"Filtros (N)"` drawer on `/partidos` (removing redundant match-number text input and aligning date/month/select controls), collapse 32-player chip wall on `/stats` `Lab Grupal` (keep `PlayerCombobox` + selected pills + `"Ver lista completa"` toggle) and replace inline formula walls with compact `?` (`min-h-10`) triggers, collapse `/reglas` sections 2–6 by default on mobile, fix clipped mobile tables, remove developer identifiers (`countsForLeague`/`countsForStats`), and fix React missing `key` runtime error in `ReglasInteractiveShell`.
- S5: Harden mobile inputs, touch targets, `/perfil`, and `/admin` — upgrade all `<input>`/`<select>`/`<textarea>` to `text-base sm:text-sm` (zero iOS Safari auto-zoom), enforce `min-h-10` (`>=40px`) touch targets, collapse "Crear Temporada" in `AdminWorkspaceShell`, refactor `MatchEditModal` mobile rows (`>=40px` controls, `Escape`/backdrop close, plain Spanish labels), add confirmation to `AdminCupTab` `"Generar / Regenerar Cuadro"`, separate `teamSearch` state for Team A/B in `AdminMatchesTab`, and clean up `/perfil` & `LoginCard` (remove raw `ID:`, unnest bordered cards, clean 2-tab switcher).
- S6: Polish & verify — remove `DESIGN.md` violations (`shadow-*`, eyebrows, nested bordered cards), fix `PlayerCombobox` `z-40` backdrop collision with `BottomNav`, fix double parentheses `(Invitado (sin cuenta))` on `/admin`, run typecheck + full Vitest suite + live `390×844` mobile browser verification across all routes.

## Tasks
- [x] T1 | S1, S2 | inline | commit: uncommitted (working tree) — Global shell (`AppHeader`, `AnthemPlayer`, `BottomNav`, `layout.tsx`) + Home (`/`) chalkboard carousel & `StandingsTable`
- [x] T2 | S3 | delegated (parallel writer) | commit: uncommitted (working tree) — Mobile `/calendario` (`Agenda` default, dot cells, detail below, border/select fixes) + `CupBracketView` mobile round view
- [x] T3 | S4 | delegated (parallel writer) | commit: uncommitted (working tree) — Distill `/partidos`, `/stats`, `/reglas` (collapsible filters, compact player selector & `?` formulas, collapsed rules + React `key` fix)
- [x] T4 | S5, S6 (component fixes) | delegated (parallel writer) | commit: uncommitted (working tree) — Harden `/perfil`, `LoginCard`, `/admin`, `MatchEditModal`, `PlayerCombobox` z-index, iOS `text-base` & `min-h-10` targets
- [x] T5 | S6 | inline + browser verifier | commit: uncommitted (working tree) — Seam check (`tsc --noEmit`, `vitest run` 75/75), live `390×844` & `1280×800` browser verification across all routes

## Log
- L1: "/impeccable critique pantalla por pantalla de la app, sobretodo en mobile, se ve muy feo"
- L2: User answered critique plan: "1. C / 2. B pero dejarlo arriba de la tabla anual, que tenga un carrusel de anuncios / 3. A"
- L3: User authorized execution: "procede"
