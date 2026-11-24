# Server-First Modular Monolith Migration (Issues #15 to #21)
Branch: `feat/wu2-server-boundary-and-repos` (WU-2 slice stacked on `feat/wu1-db-schema-and-seed`) | Delivery: `ask-on-risk` | Running Authored Lines: `1625` (`+1518 / -107` across WU-1)
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
- **S3** (Issue #17 — `WU-3/7`): Capa `src/server/queries/` cacheada ejecutando `src/lib/engine` en servidor y migración a React Server Components de `/`, `/calendario`, `/reglas` y `/blog`. *(Planned)*
- **S4** (Issue #18 — `WU-4/7`): Migración Server-First de `/partidos` y `/stats` con islas `"use client"` livianas y carga diferida (`next/dynamic`) de `recharts`. *(Planned)*
- **S5** (Issue #19 — `WU-5/7`): Flujo real de Supabase Auth (`/auth/callback`, `signOutAction`) y migración SSR de `/perfil` calculando la ficha personal en servidor. *(Planned)*
- **S6** (Issue #20 — `WU-6/7`): Server Actions transaccionales protegidas por rol (`src/server/actions/`) y refactor modular de `/admin` con guardia SSR. *(Planned)*
- **S7** (Issue #21 — `WU-7/7`): Pozo server-only (`admin`), importador `LOLONMEBOL.xlsx` transaccional contra PostgreSQL y retiro definitivo de `TournamentProvider.tsx`, `localStorage` y `seed-data.json` del bundle cliente con test automatizado de arquitectura. *(Planned)*

## Tasks

- [x] **T1** (`S1`, Issue #15, route: inline, status: completed, commits: `0daca6e`, `e85fc9e`, Risk: item 1 (PostgreSQL migration `0002`) + item 3 (`src/lib/excel/diff.ts` natural-key merge)): Added `0002_align_domain_and_historical_outcomes.sql`, SQL row types & bidirectional domain<->DB mappers (`src/server/db/`), idempotent `scripts/seed-supabase.ts` (`db:seed` / `db:seed:dry`), 8 unit/probe tests (`23/23` total passing), differential check on `applyImportDiff`, and independent verifier sign-off (`S1: MET`, `0` open blockers).
- [x] **T2** (`S2`, Issue #16, route: inline, status: completed, commit: `b0d1ebf`, Risk: item 2 (SSR auth session, role guards, middleware) + item 5 (`server-only` dependency)): Added `server-only` boundary across `src/server/**` (with Vitest alias and `tsx --conditions=react-server` for `db:seed`), `@supabase/ssr` session refresh `src/middleware.ts`, `getViewerSession()` + `requireAuthenticatedPlayer`/`requireOperator`/`requireAdmin` (`src/server/auth/`), segregated `PublicTournamentRepository` (no `email`/`userId`/`fund_*`, >1000-row pagination) and `AdminFundRepository` (admin-guarded + session-scoped RLS) in `src/server/repositories/` (Supabase + deterministic seed fallback), 13 new unit/contract tests (`36/36` passing), live Supabase read smoke test, `next build` pass, and independent verifier sign-off (`S2: MET`, `S1: MET`, `0` open blockers).
- [ ] **T3** (`S3`, Issue #17, route: inline, status: planned): Cached server queries and RSC migration of `/`, `/calendario`, `/reglas`, `/blog`.
- [ ] **T4** (`S4`, Issue #18, route: inline, status: planned): Server-First `/partidos` and `/stats` with thin interactive islands and lazy `recharts`.
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
