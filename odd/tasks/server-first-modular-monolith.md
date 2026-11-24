# Server-First Modular Monolith Migration (Issues #15 to #21)
Branch: `feat/wu1-db-schema-and-seed` (WU-1 slice) | Delivery: `ask-on-risk` | Running Authored Lines: `1625` (`+1518 / -107` across `0daca6e`, `e85fc9e`)
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
- **S2** (Issue #16 — `WU-2/7`): Frontera `src/server/` protegida con `server-only`, middleware `@supabase/ssr`, sesión/guardas SSR (`requireOperator`, `requireAdmin`) y repositorios segregados (`PublicTournamentRepository` sin `fund_*` ni `email` vs `AdminFundRepository`). *(Planned)*
- **S3** (Issue #17 — `WU-3/7`): Capa `src/server/queries/` cacheada ejecutando `src/lib/engine` en servidor y migración a React Server Components de `/`, `/calendario`, `/reglas` y `/blog`. *(Planned)*
- **S4** (Issue #18 — `WU-4/7`): Migración Server-First de `/partidos` y `/stats` con islas `"use client"` livianas y carga diferida (`next/dynamic`) de `recharts`. *(Planned)*
- **S5** (Issue #19 — `WU-5/7`): Flujo real de Supabase Auth (`/auth/callback`, `signOutAction`) y migración SSR de `/perfil` calculando la ficha personal en servidor. *(Planned)*
- **S6** (Issue #20 — `WU-6/7`): Server Actions transaccionales protegidas por rol (`src/server/actions/`) y refactor modular de `/admin` con guardia SSR. *(Planned)*
- **S7** (Issue #21 — `WU-7/7`): Pozo server-only (`admin`), importador `LOLONMEBOL.xlsx` transaccional contra PostgreSQL y retiro definitivo de `TournamentProvider.tsx`, `localStorage` y `seed-data.json` del bundle cliente con test automatizado de arquitectura. *(Planned)*

## Tasks

- [x] **T1** (`S1`, Issue #15, route: inline, status: completed, commits: `0daca6e`, `e85fc9e`, Risk: item 1 (PostgreSQL migration `0002`) + item 3 (`src/lib/excel/diff.ts` natural-key merge)): Added `0002_align_domain_and_historical_outcomes.sql`, SQL row types & bidirectional domain<->DB mappers (`src/server/db/`), idempotent `scripts/seed-supabase.ts` (`db:seed` / `db:seed:dry`), 8 unit/probe tests (`23/23` total passing), differential check on `applyImportDiff`, and independent verifier sign-off (`S1: MET`, `0` open blockers).
- [ ] **T2** (`S2`, Issue #16, route: inline, status: planned): `server-only` boundary, `@supabase/ssr` session/guards, and segregated public/admin repositories.
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
