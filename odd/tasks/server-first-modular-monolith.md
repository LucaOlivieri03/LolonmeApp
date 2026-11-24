# Server-First Modular Monolith Migration (Issues #15 to #21)
Branch: `feat/wu4-partidos-and-stats-rsc` (WU-4 slice stacked on `feat/wu3-server-queries-and-public-rsc`) | Delivery: `ask-on-risk` | Running Authored Lines: `4600+` (`+1625` WU-1, `+1806` WU-2, WU-3 `894f256`)
Runner: `npm run typecheck`, `npm test` (`vitest run`), `npm run build`

## Specs

- **S1** (Issue #15 — `WU-1/7`): Alinear esquema PostgreSQL de Supabase con el modelo de dominio histórico y script idempotente `db:seed`.
  - User request context: `"alternativa A. Se busca la menor carga sobre el cliente. Ya que se va a comenzar a trabajar más enfocado en el producto real, ya que actualmente era solo un MVP"` / `"Armá un plan prolijo para esto armando unidades de trabajo y cargando las cosas para hacer en gh issues"` / `"si"` (arrancar `WU-1` `#15` desde `main`).
  - Nueva migración `supabase/migrations/0002_align_domain_and_historical_outcomes.sql`:
    - Agregar `result_outcome text CHECK (result_outcome IS NULL OR result_outcome IN ('A', 'B', 'draw'))` y `slug text NOT NULL UNIQUE` (con backfill seguro y desambiguación de duplicados) en `public.matches`.
    - Agregar `slug text NOT NULL UNIQUE` normalizado sin acentos y a prueba de colisiones en `public.players` y `external_key text UNIQUE` en `public.announcements`, `public.calendar_events` y `public.fund_transactions`.
  - Mappers puros bidireccionales DB <-> Dominio en `src/server/db/mappers.ts` (y tipos de fila SQL en `src/server/db/types.ts`), preservando paridad 100% con `TournamentDataset`, `computeStandings` y `applyImportDiff`/`computeImportDiff`.
  - Script CLI reproducible e idempotente `scripts/seed-supabase.ts` (`npm run db:seed` / `npm run db:seed:dry`) usando `SUPABASE_SERVICE_ROLE_KEY` y deduplicación por `onConflict` en `src/server/db/seed-sync.ts`.
  - Actualizar `.env.example`, `package.json` y `README.md`.
- **S2** (Issue #16 — `WU-2/7`): Arquitectura Server: Frontera `server-only`, sesión SSR y repositorios tipados.
  - User request: `"avanza con WU-2 (#16) para armar src/server/ (server-only, sesión SSR y repositorios reales contra tu Supabase)"`.
  - Protección de bundle (`server-only`): instalar `server-only` e incorporarlo en todos los módulos bajo `src/server/` para que cualquier import accidental desde un componente `"use client"` falle en tiempo de compilación (manteniendo `vitest` y `npm run db:seed` operativos).
  - Sesión y Guardas SSR (`src/server/auth/` + `src/middleware.ts`):
    - Configurar middleware liviano de refresco de sesión `@supabase/ssr`.
    - Implementar `getViewerSession()` (`role: 'admin' | 'authorized' | 'player' | 'guest'`, `playerId`, `userId`) y guardas reutilizables `requireAuthenticatedPlayer()`, `requireOperator()` y `requireAdmin()`.
  - Puertos y Repositorios (`src/server/repositories/`):
    - Definir interfaces segregadas: `PublicTournamentRepository` (temporadas, jugadores sin `email`, títulos, partidos, copa, calendario, anuncios) y `AdminFundRepository` (exclusivo para Pozo y gestión sensible).
    - Implementar `SupabaseTournamentRepository` / `SupabaseAdminFundRepository` (producción/desarrollo conectado) y adaptador server-side de respaldo para ejecución determinística de tests/CI sin credenciales expuestas al cliente.
  - Tests unitarios:
    - Verificar en Vitest las guardas de rol (`401` / `403`) y comprobar que `PublicTournamentRepository` nunca expone `email` ni entidades `fund_*`.
  - Criterios de aceptación:
    - Importar cualquier archivo de `src/server/**` desde un módulo `"use client"` falla en build gracias a `server-only`.
    - `PublicTournamentRepository` retorna únicamente proyecciones públicas tipadas (sin campos financieros del Pozo ni correos).
    - Guardas `requireOperator` y `requireAdmin` cubiertas con tests unitarios en el mismo commit.
    - `npm run typecheck && npm test && npm run build` pasan sin errores.
    - Rollback limpio: revertir `src/server/auth`, `src/server/repositories` y `src/middleware.ts` no rompe ninguna ruta existente.
- **S3** (Issue #17 — `WU-3/7`): SSR Lecturas Públicas: Queries cacheadas y migración RSC de Inicio, Calendario, Reglas y Blog.
  - User request: `"segui con WU 3"`.
  - Queries de servidor con caché (`src/server/queries/public.ts`, protegidas con `server-only`):
    - `getHomeViewModel(seasonYear?)`: ejecuta `computeStandings` (Anual e Histórica) y resuelve las llaves de Copa y anuncios fijados en el servidor, cacheado con tags (`seasons`, `matches`, `cup`, `announcements`).
    - `getCalendarViewModel(seasonYear?)`: entrega eventos y resumen mensual ya agrupados desde el servidor.
  - Conversión a React Server Components:
    - Migrar `src/app/page.tsx`, `src/app/calendario/page.tsx`, `src/app/reglas/page.tsx` y `src/app/blog/page.tsx` quitando `"use client"` y `useTournament()`.
    - Dejar en cliente únicamente micro-islas de UI donde exista interacción real (cambio de pestaña `Anual / Histórica / Copa` o selector de temporada vía URL `searchParams` / componente liviano que recibe filas ya pre-calculadas).
  - Tests:
    - Tests en Vitest para `getHomeViewModel` y `getCalendarViewModel` validando paridad exacta con `src/lib/engine`.
  - Criterios de aceptación:
    - `/`, `/calendario`, `/reglas` y `/blog` no importan `useTournament` ni ejecutan `computeStandings` en el cliente.
    - El payload enviado a los componentes interactivos de Inicio contiene únicamente las filas de tabla/copa ya calculadas (0 partidos crudos innecesarios, 0 datos de Pozo).
    - Navegación mobile y desktop mantienen intacta la estética Boletín Oficial de Federación en Cancha.
    - `npm run typecheck && npm test && npm run build` pasan sin errores.
- **S4** (Issue #18 — `WU-4/7`): Migración Server-First de `/partidos` y `/stats` con islas `"use client"` livianas y carga diferida (`next/dynamic`) de `recharts`.
  - User request: `"avanza con WU-4"`.
  - Queries de servidor con caché (`src/server/queries/public.ts`, protegidas con `server-only`):
    - `getMatchesViewModel(filters)`: filtra partidos en servidor con `filterMatches`, pre-resuelve nombres de jugadores/MVPs y equipos `teamA`/`teamB`, y entrega `availableMatchNumbers` + opciones livianas de jugadores.
    - `getStatsViewModel(filters)`: calcula en servidor `computeStandings` (histórico y por temporada), padrón activo (`totalPjAllMatches >= 3`), Lab Grupal (`computeSubgroupStats` y `computePairwiseStats` para 2 jugadores), y ficha por jugador (`profileRow`, top 6 `bestTeammates` por Wilson CT% y top 6 `topRivals` por `|h2hBalance|`), sin enviar partidos crudos al cliente.
  - Conversión a React Server Components e islas livianas:
    - Migrar `src/app/partidos/page.tsx` y `src/app/stats/page.tsx` a RSC leyendo filtros desde `searchParams` (sin `"use client"`, sin `useTournament()`, sin cálculos de `src/lib/engine` en cliente).
    - Crear islas cliente livianas (`src/components/matches/PartidosInteractiveView.tsx`, `src/components/stats/StatsInteractiveView.tsx`) sincronizadas por URL `searchParams`.
    - Aislar `recharts` en `src/components/stats/StatsCharts.tsx` y cargarlo de forma diferida con `next/dynamic(..., { ssr: false })`.
  - Tests:
    - Tests en Vitest validando paridad exacta de `loadMatchesViewModel` y `loadStatsViewModel` con `src/lib/engine`, ausencia de datos crudos/sensibles (`matches` en stats, `email`, `userId`, `fund_*`), y contrato arquitectónico RSC + lazy `recharts`.
  - Criterios de aceptación:
    - `/partidos` y `/stats` no importan `useTournament` ni ejecutan el motor estadístico en cliente.
    - `recharts` queda diferido vía `next/dynamic` y fuera del bundle inicial de `/stats`.
    - Se preservan todos los filtros, acordeón de partidos, Lab Grupal, Stats por Jugador, definiciones de fórmulas y estética Boletín Oficial.
    - `npm run typecheck && npm test && npm run build` pasan sin errores.
- **S5** (Issue #19 — `WU-5/7`): Flujo real de Supabase Auth (`/auth/callback`, `signOutAction`) y migración SSR de `/perfil` calculando la ficha personal en servidor. *(Planned)*
- **S6** (Issue #20 — `WU-6/7`): Server Actions transaccionales protegidas por rol (`src/server/actions/`) y refactor modular de `/admin` con guardia SSR. *(Planned)*
- **S7** (Issue #21 — `WU-7/7`): Pozo server-only (`admin`), importador `LOLONMEBOL.xlsx` transaccional contra PostgreSQL y retiro definitivo de `TournamentProvider.tsx`, `localStorage` y `seed-data.json` del bundle cliente con test automatizado de arquitectura. *(Planned)*

## Tasks

- [x] **T1** (`S1`, Issue #15, route: inline, status: completed, commits: `0daca6e`, `e85fc9e`, Risk: item 1 (PostgreSQL migration `0002`) + item 3 (`src/lib/excel/diff.ts` natural-key merge)): Added `0002_align_domain_and_historical_outcomes.sql`, SQL row types & bidirectional domain<->DB mappers (`src/server/db/`), idempotent `scripts/seed-supabase.ts` (`db:seed` / `db:seed:dry`), 8 unit/probe tests (`23/23` total passing), differential check on `applyImportDiff`, and independent verifier sign-off (`S1: MET`, `0` open blockers).
- [x] **T2** (`S2`, Issue #16, route: inline, status: completed, commit: `b0d1ebf`, Risk: item 2 (SSR auth session, role guards, middleware) + item 5 (`server-only` dependency)): Added `server-only` boundary across `src/server/**` (with Vitest alias and `tsx --conditions=react-server` for `db:seed`), `@supabase/ssr` session refresh `src/middleware.ts`, `getViewerSession()` + `requireAuthenticatedPlayer`/`requireOperator`/`requireAdmin` (`src/server/auth/`), segregated `PublicTournamentRepository` (no `email`/`userId`/`fund_*`, >1000-row pagination) and `AdminFundRepository` (admin-guarded + session-scoped RLS) in `src/server/repositories/` (Supabase + deterministic seed fallback), 13 new unit/contract tests (`36/36` passing), live Supabase read smoke test, `next build` pass, and independent verifier sign-off (`S2: MET`, `S1: MET`, `0` open blockers).
- [x] **T3** (`S3`, Issue #17, route: inline, status: completed, commit: `894f256`, Risk: none): Added tagged cached server queries (`src/server/queries/`), pre-resolved cup ties & calendar match summaries (`src/lib/types/view-models.ts`), migrated `/`, `/calendario`, `/reglas` (plus verified `/blog`) to React Server Components with thin interactive client islands, 5 new parity & RSC contract tests (`41/41` passing), and verified `next build` First Load JS drop (`/` `214 kB -> 120 kB`, `/calendario` `213 kB -> 121 kB`, `/reglas` `124 kB -> 117 kB`).
- [x] **T4** (`S4`, Issue #18, route: inline, status: completed, commit: `bbbb8bf`, Risk: none): Added tagged cached server queries `getMatchesViewModel` and `getStatsViewModel` (`src/server/queries/public.ts`), migrated `/partidos` and `/stats` to React Server Components with URL `searchParams` filtering and thin client islands (`src/components/matches/PartidosInteractiveView.tsx`, `src/components/stats/StatsInteractiveView.tsx`), isolated `recharts` into `src/components/stats/StatsCharts.tsx` loaded via `next/dynamic(..., { ssr: false })`, added 3 new parity & architectural contract tests (`44/44` passing across 6 suites), and verified `next build` First Load JS drop (`/stats` `319 kB -> 123 kB` `-61%`, `/partidos` `123 kB` with `4.2 kB` page JS).
- [ ] **T5** (`S5`, Issue #19, route: inline, status: planned): Real Supabase Auth flow and SSR `/perfil` + session-aware header.
- [ ] **T6** (`S6`, Issue #20, route: inline, status: planned): Role-guarded Server Actions and modular `/admin` split + `MatchEditModal` DB persistence.
- [ ] **T7** (`S7`, Issue #21, route: inline, status: planned): Admin-only Pozo SSR/actions, DB-backed Excel importer, and removal of `TournamentProvider.tsx` + client bundle guard test.

## Log

- **L1** (2026-11-24):
  - `"Cual es la estructura y arquitectura de la App? Tanto en carpetas como arquitectura en si, tiene backend y frontend separado? Si no es asi, es un gran error."`
  - `"alternativa A. Se busca la menor carga sobre el cliente. Ya que se va a comenzar a trabajar más enfocado en el producto real, ya que actualmente era solo un MVP"`
  - `"Armá un plan prolijo para esto armando unidades de trabajo y cargando las cosas para hacer en gh issues"`
  - `"si"` (autorización explícita para ejecutar `WU-1` / Issue `#15` en rama limpia desde `main`).
- **L2** (2026-11-24): Fetched `origin/main` (`824293e`, includes merged PR #14), fast-forwarded local `main`, created branch `feat/wu1-db-schema-and-seed`, and initialized ODD feature document for WU-1 (`T1` / `S1`).
- **L3** (2026-11-24): Implemented `T1` (`0daca6e`). Independent verifier (`odd-verifier`) identified 4 PostgreSQL constraint/roundtrip edge cases (`B1`: pre-existing null-slug matches on upsert; `B2`: case-sensitive `raw_name` alias UUIDs; `B3`: natural-key merge for `titles`/`aliases` in `diff.ts` + batch `onConflict` deduplication against Postgres `21000`; `B4`: deterministic descending date sort in `mapDatabaseRowsToDataset`). Fixed all 4 in `e85fc9e` with 4 regression probes (`23/23` tests passing), verified `DIFFERENTIAL_CHECK_IDENTICAL` against `824293e` for `applyImportDiff`, and received `S1: MET` / `Open Blockers: NONE` on scoped verifier recheck. Baseline First Load JS recorded: `/` `214 kB`, `/stats` `319 kB`.
- **L4** (2026-11-24):
  - `"avanza con WU-2 (#16) para armar src/server/ (server-only, sesión SSR y repositorios reales contra tu Supabase)"`
  - Branched `feat/wu2-server-boundary-and-repos` from `feat/wu1-db-schema-and-seed` (`5767a26`) to implement `T2` (`S2`, Issue #16).
- **L5** (2026-11-24): Completed `T2` (`b0d1ebf`). Verified `npm run typecheck`, `npm test` (`36/36` passing across 5 suites), `npm run db:seed:dry`, `npm run build` (`12/12` pages + `Middleware 95.2 kB`), and live read smoke test via `SupabaseTournamentRepository` against Supabase PostgreSQL (`2` seasons, `59` players, `86` matches, `937` match_players, `hasFundKeys: false`, `hasEmailOrUserId: false`). Independent read-only verifier (`odd-verifier`) signed off `S2: MET`, `S1 (non-regression): MET`, `Open Blockers: NONE`.
- **L6** (2026-11-24):
  - `"segui con WU 3"`
  - Branched `feat/wu3-server-queries-and-public-rsc` from `feat/wu2-server-boundary-and-repos` (`fe8cfd5`) to implement `T3` (`S3`, Issue #17).
- **L7** (2026-11-24): Completed `T3` (`894f256`). Verified `npm run typecheck`, `npm test` (`41/41` passing across 6 suites), and `npm run build` (`12/12` routes). Measured First Load JS drops: `/` `214 kB -> 120 kB` (`-44%`), `/calendario` `213 kB -> 121 kB` (`-43%`), `/reglas` `124 kB -> 117 kB` (page JS `8.57 kB -> 1.66 kB`).
- **L8** (2026-11-24):
  - `"avanza con WU-4"`
  - Branched `feat/wu4-partidos-and-stats-rsc` from `feat/wu3-server-queries-and-public-rsc` (`75839a9`) to implement `T4` (`S4`, Issue #18).
- **L9** (2026-11-24): Completed `T4` (`bbbb8bf`). Verified `npm run typecheck`, `npm test` (`44/44` passing across 6 suites), and `npm run build` (`12/12` routes). Measured First Load JS: `/stats` `319 kB -> 123 kB` (`-61%`, `7.52 kB` page JS, `recharts` deferred via `next/dynamic`), `/partidos` `123 kB` (`4.2 kB` page JS).
