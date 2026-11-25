# LolonmeApp — Torneo Oficial LOLONMEBOL

Aplicación web mobile-first para gestionar el torneo LOLONMEBOL: Tabla Anual e Histórica, Copa LOLONMEBOL, Laboratorio de Estadísticas, Calendario, Reglas, Perfil y Administración.

## Arquitectura Server-First (Modular Monolith)

- **Frontera estricta `server-only` (`src/server/`)**:
  - `src/server/auth/`: sesión SSR con `@supabase/ssr`, `getViewerSession()` y guardas por rol (`requireAuthenticatedPlayer`, `requireOperator`, `requireAdmin`).
  - `src/server/repositories/`: repositorios segregados `PublicTournamentRepository` (proyecciones públicas sin `email`, `user_id` ni `fund_*`) y `AdminFundRepository` (exclusivo `admin` + RLS `public.is_admin()`).
  - `src/server/queries/`: ViewModels cacheados con `unstable_cache` y `CACHE_TAGS` para rutas RSC públicas (`/`, `/partidos`, `/stats`, `/calendario`, `/reglas`, `/blog`) y lecturas dinámicas protegidas para `/perfil` y `/admin`.
  - `src/server/admin/` + `src/server/actions/`: Server Actions validadas y protegidas por rol con rollback compensatorio y revalidación de caché, más sincronización idempotente de `LOLONMEBOL.xlsx` contra PostgreSQL (`/api/import-excel`).
- **Cliente liviano**: cero `TournamentProvider`, cero `localStorage`, cero `seed-data.json` en el bundle cliente, e islas `"use client"` mínimas (con `recharts` diferido vía `next/dynamic`).

## Inicio rápido

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar variables de entorno copiando `.env.example` a `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` *(solo servidor / scripts CLI)*
3. Aplicar las migraciones SQL en orden sobre Supabase PostgreSQL:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_align_domain_and_historical_outcomes.sql`
4. Poblar la base de datos de forma idempotente desde el historial oficial:
   ```bash
   npm run seed:excel      # Regenera src/lib/data/seed-data.json desde docs/LOLONMEBOL.xlsx
   npm run db:seed:dry     # Valida el mapeo SQL sin requerir conexión remota
   npm run db:seed         # Sincroniza (upsert idempotente) contra Supabase PostgreSQL
   ```
5. Iniciar entorno local:
   ```bash
   npm run dev
   ```

## Comandos de verificación

| Comando | Propósito |
| :--- | :--- |
| `npm run typecheck` | Verificación estricta de tipos TypeScript (`tsc --noEmit`) |
| `npm test` | Suite unitaria, seguridad, repositorios, queries y contratos de arquitectura (`vitest run`) |
| `npm run db:seed:dry` | Validación local del payload SQL de seeding |
| `npm run build` | Compilación de producción de Next.js |
