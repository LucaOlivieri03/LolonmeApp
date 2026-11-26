# President Observations — Casi Obligatorio (#33–#39)
Branch: `feat/google-oauth-and-player-linking` | Issues: `#33`, `#34`, `#35`, `#36` (blocked), `#37`, `#38`, `#39`

## Specs
- **S1 (#33):** `cambiar esto a “LOLONMEAPP - Sitio oficial de la LOLONMEBOL”` (browser `<title>` + `public/manifest.json`).
- **S2 (#34a):** `en los partidos de 2025 sacar el “Ganó Eq. A”. es redundante porque siempre el equipo A es el ganador. no reemplazarlo, sacarlo. y en los partidos de 2026 dejarlo como está ya que ahí empezamos a tener registro de los resultados exactos`
- **S3 (#34b):** `partidos 2026: agregar el dato de “0 goles y 0 asistencias”` (render `0G / 0A` for 2026 players with 0 goals and 0 assists).
- **S4 (#35):** `en general, que todo lo referido a liga, copa, lolonmebol o f11 tome el color correspondiente acorde al sheets (violeta, azul, rojo y granate). que tomen directa y exactamente el color del sheets sería un golazo.` Exact Google Sheets hex (`Fechas 26`): Liga `#8E7CC3`, Copa `#3D85C6`, LOLONMEBOL `#E06666`, F11 `#C27BA0`.
- **S5 (#36):** `cambiar todos los logos viejos por el nuevo` (blocked — new logo asset not present in repo).
- **S6 (#37):** `recortar el estrib del himno. que arranque en “nossa lolonmebol…”`
- **S7 (#38):** `en tabla anual, una vez arrancada la copa, solo aclarar que el puntero juega la lolonmebol. sacar las aclaraciones de puestos de copa.`
- **S8 (#39):** `cambiarlos a: Liga / Copa / LOLONMEBOL / Fechas especiales` (replace `Liga Anual`, `Copa Anual`, `Final LOLONMEBOL`, `Fechas Especiales`).

## Tasks
- [x] **T1** (S1, S6, S8) — route: inline — Update page `<title>`/`manifest.json` (#33), trim anthem chorus start to `10.8s` (`"nossa lolonmebol..."`) (#37), rename competition labels (#39) — commit: `629abc0` — Risk: none
- [x] **T2** (S2, S3) — route: inline — 2025/2026 match cards: remove `"Ganó Eq. A"` for 2025 and show `0G / 0A` for 2026 (#34) + unit tests (`src/lib/matches/display.test.ts`) — commit: `a279bbe` — Risk: none
- [x] **T3** (S4) — route: inline — Apply exact Sheets tournament colors (`#8E7CC3`, `#3D85C6`, `#E06666`, `#C27BA0`) across globals, matches, calendar, cup bracket, and home tabs (#35) — commit: `24820bb` — Risk: none
- [x] **T4** (S7) — route: inline — Annual standings: once Copa starts, hide Copa qualification cutlines/legends and show only LOLONMEBOL qualification for 1st place (#38) — commit: `49198c1` — Risk: none
- [ ] **T5** (S5) — route: blocked — Replace all old logos with new logo (#36) — waiting on new logo asset from user — commit: blocked

## Log
- **L1:** `Avanzá con los casi obligatorio` (following validated issues `#33`–`#39` from Google Doc `10a_wRGgUvyz_ZSh08Wr6RC_VIz9e2aZLRW2g2ZIjZZo` and Sheet `17lmhs4oVIT-GuxaQ-wi9r3UdC1k7LqVUDP--QCpnYuE`).
- **L2:** Verified `npm run typecheck` (0 errors) and `npm test` (10/10 files, 88/88 tests passed). Verified anthem chorus timestamp by ear (`10.8s` starts cleanly on `"Nossa LOLONMEBOL..."`). T5 (#36) blocked pending new logo file from user.
