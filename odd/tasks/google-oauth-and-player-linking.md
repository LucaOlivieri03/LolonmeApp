# Google OAuth Login, Email Pre-Linking & Admin-Approved Player Link Requests (#29)
Branch: `feat/google-oauth-and-player-linking` (stacked on `feat/mobile-ui-overhaul-and-themes` @ `77bdc7e`, now merged into `main`) | Delivery: `single-pr` (`size:exception` approved by user; commits `e49f363`..`cbd1bef`)
Runner: `npm test` (`vitest run`), `npm run typecheck` (`tsc --noEmit`), `npm run build` (`next build`)

## Specs

- **S1 — DB Schema, RLS & Pre-Link Trigger (`supabase/migrations/0003_player_link_requests.sql`)**:
  - Quote (#29): *"Crear tabla `public.player_link_requests`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `email text NOT NULL`, `requested_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))`, `reviewed_by uuid REFERENCES public.players(id) ON DELETE SET NULL`, `review_note text`, `created_at timestamptz NOT NULL DEFAULT now()`, `reviewed_at timestamptz`."*
  - Quote (#29): *"Agregar índice único parcial `UNIQUE (user_id) WHERE status = 'pending'` para limitar a una solicitud activa por cuenta."*
  - Quote (#29): *"Usuarios autenticados (`auth.uid() = user_id`) solo pueden leer e insertar su propia solicitud `pending` hacia un jugador activo con `user_id IS NULL` y `role <> 'admin'`. Solo `public.is_admin()` puede listar todas las solicitudes y actualizar su estado (`approved` / `rejected`)."*
  - Quote (#29): *"Un jugador cuyo email esté precargado en `public.players` queda vinculado automáticamente al entrar con Google por primera vez."*
  - Provide `SECURITY DEFINER` RPC `public.admin_list_player_auth_links()` gated by `public.is_admin()` (respecting `REVOKE SELECT (email) ON public.players FROM anon, authenticated`) and harden `public.handle_new_auth_user()` + case-insensitive unique email index on `public.players`.
  - Checks: migration SQL structural & policy/constraint tests in `src/server/db/db.test.ts`.

- **S2 — Google OAuth Login (`src/server/auth/actions-core.ts`, `src/server/actions/auth.ts`, `src/components/profile/LoginCard.tsx`)**:
  - Quote (#29): *"Agregar Server Action `signInWithGoogleAction()` que invoca `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "<safeOrigin>/auth/callback?next=/perfil" } })` validando el origen con `resolveSafeAppOrigin`."*
  - Quote (#29): *"Reutilizar `/auth/callback` (`exchangeCodeForSession` + `sanitizeRedirectPath`) sin introducir nuevos endpoints públicos."*
  - Quote (#29): *"Actualizar `LoginCard.tsx` destacando **"Continuar con Google"** como botón principal y dejando el acceso por código/enlace de email como opción secundaria."*
  - Quote (#29): *"Botón **"Continuar con Google"** operativo en `/perfil`, redirigiendo correctamente vía `/auth/callback` a `/perfil`."*
  - Checks: RED/GREEN unit tests in `src/server/auth/auth.test.ts` covering `performSignInWithGoogle`, origin sanitization, unconfigured/provider errors, and callback integration.

- **S3 — Unlinked `/perfil` Player Selection & Pending State (`src/server/queries/profile.ts`, `src/app/perfil/page.tsx`, `src/components/profile/UnlinkedAccountCard.tsx`)**:
  - Quote (#29): *"Extender `ProfileViewModel` (`status: "unlinked"`) en `src/server/queries/profile.ts` para incluir: `pendingRequest`: solicitud pendiente actual del usuario (si existe). `availablePlayers`: lista mínima (`id`, `displayName`, `nickname`) de jugadores activos sin cuenta vinculada (`user_id IS NULL`) y con `role !== "admin"` (sin exponer correos ni `userId`)."*
  - Quote (#29): *"Agregar Server Action `requestPlayerLinkAction`: verifica sesión autenticada sin ficha vinculada, valida que el jugador siga disponible y no sea `admin`, y registra la solicitud en `player_link_requests`."*
  - Quote (#29): *"Actualizar `/perfil` para que el usuario no vinculado pueda buscarse en el padrón (`PlayerCombobox`) y enviar su solicitud, o ver el estado "Esperando aprobación del administrador" si ya la envió."*
  - Quote (#29): *"Un usuario cuyo email no esté en `public.players` ve únicamente jugadores libres no-`admin`, puede enviar una solicitud y ve el estado pendiente al recargar."*
  - Checks: RED/GREEN unit tests in `src/server/auth/auth.test.ts` and `src/server/queries/queries.test.ts` (role guards, exclusion of `admin` & already-linked/inactive players, duplicate pending request rejection, RSC contract on `src/app/perfil/page.tsx`).

- **S4 — Admin Link Request Queue & Email Pre-Linking (`src/server/queries/admin.ts`, `src/server/admin/mutations-core.ts`, `src/server/actions/players.ts`, `src/components/admin/AdminPlayersTab.tsx`)**:
  - Quote (#29): *"Extender `getAdminViewModel()` (`src/server/queries/admin.ts`) para hidratar `pendingLinkRequests` y estado de vinculación de jugadores únicamente cuando `session.role === "admin"` (nunca para `authorized`)."*
  - Quote (#29): *"Implementar Server Actions protegidas con `requireAdmin` (con cores testeables en `src/server/admin/mutations-core.ts`): `approvePlayerLinkRequestAction(requestId)`: verifica que el jugador destino siga libre (`user_id IS NULL`), asigna `user_id` y `email` en `public.players`, marca la solicitud como `approved` (`reviewed_by`, `reviewed_at`) y rechaza otras solicitudes pendientes que apunten al mismo jugador. `rejectPlayerLinkRequestAction(requestId, reviewNote?)`: marca la solicitud como `rejected`. `updatePlayerEmailAction(playerId, email)`: permite precargar o corregir el email de los jugadores de la lista inicial (normalizado en minúsculas y validado) para habilitar auto-vinculación al primer login con Google."*
  - Quote (#29): *"Actualizar `AdminPlayersTab.tsx` con: Panel de **Solicitudes de vinculación pendientes** (contador + acciones **Aprobar** / **Rechazar**). Gestión de `email` e indicador de estado (`Vinculado` / `Email precargado` / `Sin vincular`) visible solo para `admin`."*
  - Quote (#29): *"En `/admin` → Jugadores, un `admin` puede precargar/editar emails y aprobar o rechazar solicitudes pendientes (mientras `authorized` no ve ni puede ejecutar estas acciones)."*
  - Quote (#29): *"Aprobar una solicitud asigna `user_id` + `email`, impide doble vinculación y rechaza solicitudes competidoras sobre el mismo jugador."*
  - Checks: RED/GREEN unit tests in `src/server/admin/admin.test.ts` and `src/server/queries/queries.test.ts`.

- **S5 — Documentation & Verification (`README.md`, full suite & build)**:
  - Quote (#29): *"Los administradores iniciales se marcan directamente en Supabase (`public.players`: `role = 'admin'` + `email` precargado). Documentar en `README.md` la configuración en Google Cloud Console y Supabase Dashboard (Provider Google + Redirect URLs de producción y local hacia `/auth/callback`)."*
  - Quote (#29): *"Tests unitarios en Vitest cubriendo guardas de rol (`guest`/`player`/`authorized`/`admin`), bloqueo de jugadores ya vinculados o `admin`, aprobación/rechazo y validación de email."*
  - Quote (#29): *"`npm run typecheck && npm test && npm run build` pasan sin errores."*

## Tasks

- [x] **T1** (`S1`, route: `inline` — sequential foundation schema/RLS/RPCs, Risk: Item 1 & Item 2, status: `completed`, commit: `e49f363`, RED/GREEN: `db.test.ts` 9/9) — Create `supabase/migrations/0003_player_link_requests.sql` + migration contract tests in `src/server/db/db.test.ts`.
- [x] **T2** (`S2`, route: `inline` — depends on auth contracts, Risk: Item 2, status: `completed`, commit: `c95d70d`, RED/GREEN: `auth.test.ts` 11/11) — Implement `performSignInWithGoogle`, `signInWithGoogleAction`, `LoginCard.tsx` Google-first UX, and unit tests in `src/server/auth/auth.test.ts`.
- [x] **T3** (`S3`, route: `inline` — depends on T1 schema & T2 auth core, Risk: Item 2, status: `completed`, commit: `5388eab`, RED/GREEN: `auth.test.ts` 12/12, `queries.test.ts` 10/10) — Extend `ProfileViewModel`, `loadProfileViewModel` / `getAuthenticatedProfileViewModel`, `performRequestPlayerLink` + `requestPlayerLinkAction`, `UnlinkedAccountCard.tsx`, `/perfil`, and unit tests.
- [x] **T4** (`S4`, route: `inline` — depends on T1 RPC/schema & T3 types, Risk: Item 2, status: `completed`, commit: `b99ff83`, RED/GREEN: `admin.test.ts` 15/15, `wu7.test.ts` 8/8) — Extend `getAdminViewModel`, implement `performApprovePlayerLinkRequest`, `performRejectPlayerLinkRequest`, `performUpdatePlayerEmail` + actions, update `AdminWorkspaceShell.tsx` & `AdminPlayersTab.tsx`, and unit tests.
- [x] **T5** (`S5`, route: `inline` — closing docs + full suite/build + independent high-risk verifier, Risk: Item 1 & Item 2, status: `completed`, commits: `b249c07`, `a551645`) — Documented Google Cloud Console, Supabase OAuth & Redirect URLs, migration `0003`, and initial Admin DB bootstrap in `README.md`; `npm run typecheck && npm test && npm run build` passed (`82/82` tests, `12/12` routes); independent adversarial verifier confirmed `S1`–`S5` `met` with `0` open blockers.

## Log

- **L1 (2026-11-25)**: User request verbatim: `Toma el issue https://github.com/LucaOlivieri03/LolonmeApp/issues/29`
- **L2 (2026-11-25)**: Exploration findings: `0001_initial_schema.sql:368` revokes `SELECT (email)` on `public.players` from `anon, authenticated` and `admin.test.ts:834` forbids `.select(...email...)` in `mutations-core.ts`. Designed `public.admin_list_player_auth_links()` (`SECURITY DEFINER` gated by `public.is_admin()`) for admin email/link status hydration, hardened `handle_new_auth_user()` + case-insensitive unique email index on `public.players`, and stacked branch `feat/google-oauth-and-player-linking` on `feat/mobile-ui-overhaul-and-themes` (`77bdc7e`) to preserve mobile UI overhaul changes without conflicts.
- **L3 (2026-11-25)**: Independent adversarial verification (`38299f41-5663-4104-b8c3-f95dbc6c263d`) verified `S1`, `S2`, `S3`, `S5` as `met` and surfaced 2 `S4` blockers (`B1`: incomplete rollback on `performApprovePlayerLinkRequest` leaving `players.email` mutated on failure; `B2`: 0-row CAS race on `player_link_requests` `.update(...)` without `.select("id").maybeSingle()`) plus 3 advisories (`A1`–`A3`). Added regression probe blocks to `admin.test.ts` and `auth.test.ts`, observed RED on `B1`, applied single correction batch (`a551645`) restoring `previousEmail` via `admin_list_player_auth_links` RPC + `.select("id").maybeSingle()` CAS checks + `A1`–`A3`.
- **L4 (2026-11-26)**: Scoped recheck by independent verifier (`38299f41-5663-4104-b8c3-f95dbc6c263d`) confirmed `B1` & `B2` resolved and all specs `S1`–`S5` `met` (`0` open blockers). Parent spot-checked `npm test` (`82/82` passed across 9 suites) and `npm run build` (`12/12` Next.js routes compiled cleanly).
- **L5 (2026-11-26)**: Updated database schema documentation in `docs/plan_tecnico_lolonmebol.md` (`cbd1bef`) covering migrations `0002` and `0003`. User selected `single-pr` (`size:exception`) targeting `main` after PR #30 merged.
