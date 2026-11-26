# LolonmeApp — Torneo Oficial LOLONMEBOL

Aplicación web mobile-first para gestionar el torneo LOLONMEBOL: Tabla Anual e Histórica, Copa LOLONMEBOL, Laboratorio de Estadísticas, Calendario, Reglas, Perfil y Administración.

## Arquitectura Server-First (Modular Monolith)

- **Frontera estricta `server-only` (`src/server/`)**:
  - `src/server/auth/`: sesión SSR con `@supabase/ssr`, Google OAuth + OTP PKCE vía `/auth/callback`, `getViewerSession()`, auto-solicitudes de vinculación (`player_link_requests`) y guardas por rol (`requireAuthenticatedPlayer`, `requireOperator`, `requireAdmin`).
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
   - `NEXT_PUBLIC_SITE_URL` *(ej. `http://localhost:3000` en local o `https://<tu-dominio>` en producción)*
   - `SUPABASE_SERVICE_ROLE_KEY` *(solo servidor / scripts CLI)*
3. Aplicar las migraciones SQL en orden sobre Supabase PostgreSQL:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_align_domain_and_historical_outcomes.sql`
   - `supabase/migrations/0003_player_link_requests.sql`
   - `supabase/migrations/0004_tactical_positions.sql`
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

## Autenticación con Google OAuth y Vinculación de Jugadores

El acceso en `/perfil` prioriza **Continuar con Google** sobre el flujo PKCE de Supabase (`/auth/callback`), combinando auto-vinculación por correo precargado y cola de aprobación para cuentas nuevas.

### 1. Configuración externa (Google Cloud + Supabase Dashboard)

| Plataforma | Sección | Valor requerido |
| :--- | :--- | :--- |
| **Google Cloud Console** | APIs & Services → OAuth consent screen | Tipo **External**, scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` |
| **Google Cloud Console** | Credentials → OAuth 2.0 Client ID (Web) | **Authorized JavaScript origins**: `http://localhost:3000` y `https://<tu-dominio>`<br>**Authorized redirect URI**: `https://<project-ref>.supabase.co/auth/v1/callback` |
| **Supabase Dashboard** | Authentication → Providers → Google | Habilitar **Google** y pegar **Client ID** y **Client Secret** de Google Cloud |
| **Supabase Dashboard** | Authentication → URL Configuration | **Site URL**: `https://<tu-dominio>`<br>**Redirect URLs**: `http://localhost:3000/auth/callback` y `https://<tu-dominio>/auth/callback` |

### 2. Bootstrap inicial de Administradores en base de datos

Por seguridad, las fichas con `role = 'admin'` están excluidas de las solicitudes de auto-vinculación. Para habilitar el primer administrador tras correr `npm run db:seed`, ejecutá en el **SQL Editor** de Supabase:

```sql
UPDATE public.players
SET role = 'admin',
    email = lower(btrim('tu-correo@gmail.com'))
WHERE slug = 'tu-slug-de-jugador';
```

Al iniciar sesión por primera vez con esa cuenta de Google en `/perfil`, el trigger `public.handle_new_auth_user()` vincula automáticamente `user_id` y habilita `/admin`.

### 3. Flujo operativo del padrón

- **Email precargado**: desde `/admin` → **Jugadores**, un `admin` puede precargar o corregir el email de cualquier jugador; al entrar con Google con ese mismo correo, queda vinculado sin pasos extra.
- **Solicitud de vinculación**: si un jugador entra con un correo que aún no figura en `public.players`, `/perfil` le permite buscar su ficha activa no-`admin` y enviar una solicitud (`pending`), que un `admin` aprueba o rechaza en `/admin` → **Jugadores**.

## Comandos de verificación

| Comando | Propósito |
| :--- | :--- |
| `npm run typecheck` | Verificación estricta de tipos TypeScript (`tsc --noEmit`) |
| `npm test` | Suite unitaria, seguridad, repositorios, queries y contratos de arquitectura (`vitest run`) |
| `npm run db:seed:dry` | Validación local del payload SQL de seeding |
| `npm run build` | Compilación de producción de Next.js |
