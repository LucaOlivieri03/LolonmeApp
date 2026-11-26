# Feature: Audit Fixes & Delight Pass

Branch: `feat/google-oauth-and-player-linking`
Created: 2026-11-26

## Specs

- **S1**: Fix all P1/P2/P3 findings from `/impeccable audit`:
  - Accessibility: intentional `prefers-reduced-motion` handling in `globals.css` and `CalendarInteractiveView`, skip-to-content link, remove nested interactive elements in Calendar, `sr-only` + `focus-within` on Excel file input, focus trap + scroll lock + focus restore in `MatchEditModal`, full ARIA on `PlayerCombobox`, `AnnouncementsCarousel`, `HomeCompetitionTabs`, `CupBracketView`, `StatsInteractiveView`, `ThemeSwitcher`, `aria-pressed` on toggles/filters, `scope="col"` on tables, heading hierarchy fixes, linked labels / `aria-label` on inputs, `role="alert"`/`"status"` on feedback banners, restore `:focus-visible` outlines.
  - Theming: replace `bg-ink/60` and `bg-ink/45` scrims with dark scrims (`bg-black/60` / `bg-black/50`) so `estadio` dark mode does not render milky white overlays; fix undefined `text-gold-300` in `AppHeader`; replace hardcoded `neutral-*` in `AnnouncementsCarousel`; align sticky row hover in `StandingsTable`; sync `DESIGN.md` and `public/manifest.json` with `estadio` default and 3-theme switcher.
  - Responsive & Performance: touch targets `>=24px` (ideally `40px`) on carousel dots, calendar pills, and admin filter pills; expose `AnthemPlayer` Estribillo/Completa toggle on mobile; avoid mobile Calendar SSR→`useEffect` layout flash; lazy-load Admin tabs with `next/dynamic`; pass `?matchId=` from `/partidos` "Gestionar en Admin" to open the match in `/admin`; replace raw `⭐` in `reglas/page.tsx` with Lucide `<Star />`; add subtle "Pronto" badge to `/blog` desktop link; responsive widths in `AdminMatchesTab`.
- **S2**: Implement all 6 approved `/impeccable delight` enhancements (motion-safe, zero new deps, `$0/mo`, authentic LOLONMEBOL federation voice):
  - **D1 (`AnthemPlayer`)**: 3-bar gold CSS equalizer while playing (`prefers-reduced-motion` safe), `2px` gold progress hairline for chorus (`0:10–0:21`), mobile-accessible Estribillo/Completa toggle.
  - **D2 (`StandingsTable`)**: Architectural dashed qualification cutline dividers after `#7` ("Corte directo a Copa") and `#9` ("Corte Fase Previa"), subtle gold `<Crown />` micro-accent on `#1`, unified row hover including sticky `#`/`Jugador` cells.
  - **D3 (`CupBracketView`)**: True architectural bracket elbow connectors linking Cuartos → Semis → Final, celebratory gold-crest treatment when `Final LOLONMEBOL` has a decided champion.
  - **D4 (`MatchEditModal` & `AdminMatchesTab`)**: Live matchday scoreboard strip (`Equipo A X – Y Equipo B · Ganó Equipo A`) updating as scores change + one-handed `-1`/`+1` goal steppers.
  - **D5 (`Perfil` & `LoginCard`)**: Official "Carnet de Jugador LOLONMEBOL" styling on linked profile (crested pitch-green header with `Logo.svg`, dorsal rank badge, `<Star />` row, win-rate progress bar) + `LogoLOLONMEBOL.svg` emblem above `LoginCard` title.
  - **D6 (`StatsInteractiveView` & `CalendarInteractiveView`)**: Federation banter verdict tags paired with `Química %` (e.g. `≥75%` "Dupla de Selección", `≤30%` "Mejor de Rivales") + Leather Orange "Hoy" ring and "Próxima fecha en X días" countdown pill in Calendar.

## Tasks

- [x] **T1** (`S1, S2/D1`) — Route: `inline` (shell/styles/header/anthem/theme/docs) — Verified: `tsc`, `vitest`, `next build`
  - Surface: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/layout/AppHeader.tsx`, `src/components/layout/AnthemPlayer.tsx`, `src/components/layout/ThemeSwitcher.tsx`, `public/manifest.json`, `DESIGN.md`
- [x] **T2** (`S1, S2/D2-D3`) — Route: `delegated` (parallel writer: disjoint home tournament components) — Verified: `tsc`, `vitest`, `next build`
  - Surface: `src/components/tournament/AnnouncementsCarousel.tsx`, `src/components/tournament/StandingsTable.tsx`, `src/components/tournament/CupBracketView.tsx`, `src/components/tournament/HomeCompetitionTabs.tsx`
- [x] **T3** (`S1, S2/D5-D6`) — Route: `delegated` (parallel writer: disjoint feature views) — Verified: `tsc`, `vitest`, `next build`
  - Surface: `src/components/calendar/CalendarInteractiveView.tsx`, `src/components/matches/PartidosInteractiveView.tsx`, `src/components/stats/StatsInteractiveView.tsx`, `src/app/perfil/page.tsx`, `src/components/profile/LoginCard.tsx`, `src/app/reglas/page.tsx`, `src/components/reglas/ReglasInteractiveShell.tsx`
- [x] **T4** (`S1, S2/D4`) — Route: `delegated` (parallel writer: disjoint modal/combobox/admin workspace) — Verified: `tsc`, `vitest`, `next build`
  - Surface: `src/components/tournament/MatchEditModal.tsx`, `src/components/tournament/PlayerCombobox.tsx`, `src/components/admin/AdminWorkspaceShell.tsx`, `src/components/admin/AdminMatchesTab.tsx`, `src/components/admin/AdminExcelTab.tsx`, `src/components/admin/AdminAnnouncementsTab.tsx`, `src/components/admin/AdminPlayersTab.tsx`, `src/components/admin/AdminPozoTab.tsx`, `src/components/admin/AdminCupTab.tsx`

## Log

- **L1**: "/impeccable audit en toda la página y luego /imppecable delight proponiendo mejoras con mi aprobación" → "Implementa todo lo propuesto para mejoras y delight"
