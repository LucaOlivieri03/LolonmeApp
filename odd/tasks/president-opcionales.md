# President Observations — Opcionales (#40–#43)
Branch: `feat/google-oauth-and-player-linking` | Issues: `#40`, `#41`, `#42`, `#43`

## Specs
- **S1 (#40):** `que la estadística individual de G-E-P y PG% incluyan partidos capitaneados por copa pese a no coincidir el total con los PJ, tanto en la anual como en la histórica.`
- **S2 (#41):** `STATS: ver de incluir en Efectividad el sistema de puntos de Copa (4/2/0) contandolo igual para los capitanes aunque no sumen en dicho partido. además que se pueda discriminar partidos de copa, liga o lolonmebol. si es mucho quilombo lo sacamos y dejamos nomás el PG%.`
- **S3 (#42):** `PREGUNTA: [Padrón activo con umbral mínimo de 3 PJ] es muchísima data incluir las parejas que están por debajo del umbral?` — Implement optional toggle to include pairs/players below 3 PJ while keeping 3 PJ threshold as clean default.
- **S4 (#43):** `títulos y secciones como “Fechas Especiales”, “Acceso Oficial de Jugadores” (sust+adj u oración cortita) solo dejar en mayuscula la primer palabra` — Convert Title Case headings/section titles to Spanish Sentence case.

## Tasks
- [x] **T1** (S1) — route: inline — Include Copa-captained matches in individual `G-E-P` and `PG%` (annual & historical) in `standings.ts` + unit tests (#40) — commit: `e42eb55` — Risk: none
- [x] **T2** (S2) — route: inline — Weighted Efectividad (Liga 3/1/0, Copa 4/2/0 incl. captains) + competition filter in `stats.ts` and `StatsInteractiveView.tsx`, fix `PG%` label in `perfil/page.tsx` + unit tests (#41) — commit: `349000f` — Risk: none
- [x] **T3** (S3) — route: inline — Add toggle in Stats (`Incluir < 3 PJ`, URL `?all=1`) to include pairs/players with < 3 PJ (defaulting to >= 3 PJ) (#42) — commit: `349000f` — Risk: none
- [x] **T4** (S4) — route: inline — Convert Title Case headings and section titles to Spanish Sentence case across views (#43) — commit: `6c3d0d1` — Risk: none

## Log
- **L1:** `resolvelos todos` (user authorized implementing all 4 open optional issues `#40`–`#43`).
- **L2:** Verified `npm run typecheck` (0 errors) and `npm test` (10/10 files, 89/89 tests passed, including official 2025/2026 Excel cross-check and RSC contract).
