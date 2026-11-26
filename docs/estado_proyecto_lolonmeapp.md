# Estado del Proyecto — LolonmeApp (LOLONMEBOL)

**LolonmeApp** completó la **Fase 1 (MVP Core)**, la migración a **arquitectura modular server-first con Supabase PostgreSQL + Auth**, el **rework estético integral ("Boletín Oficial de Federación en Cancha")**, el **overhaul mobile con selector de 3 temas**, la **pizarra táctica interactiva en partidos** y el sistema de **votación post-partido transparente**.

---

## Inicio rápido

1. Instalar dependencias: `pnpm install`
2. Configurar `.env.local` con las credenciales de Supabase (ver `.env.example` y [README.md](../README.md)) o levantar en modo offline con `LOLONME_LOCAL_SEED=true`
3. Levantar entorno de desarrollo: `pnpm dev` → abrir `http://localhost:3000`
4. Validar calidad: `pnpm typecheck && pnpm test && pnpm build`

> [!NOTE]
> En producción, la app corre 100% **server-first** contra Supabase PostgreSQL (con caché SSR por tags y Auth real con Google OAuth / Magic Link). Para pruebas locales sin red (solo fuera de producción), `LOLONME_LOCAL_SEED=true` habilita la lectura desde `src/lib/data/seed-data.json`.

---

## 1. Arquitectura y Stack (\$0/mes)

| Capa | Implementación actual | Archivos clave |
| :--- | :--- | :--- |
| **Framework & UI** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide, Recharts | `package.json`, `src/app/layout.tsx`, `src/app/globals.css` |
| **PWA & Media** | Manifest instalable, Service Worker, escudos SVG y reproductor de himno (estribillo desde `10.8s` / completo) | `public/manifest.json`, `public/sw.js`, `src/components/layout/AnthemPlayer.tsx` |
| **Base de datos & Auth** | Esquema PostgreSQL (`0001`–`0003`) + políticas RLS por roles (`admin`, `authorized`, `player`, `guest`), Google OAuth, pre-vinculación por email y cola de solicitudes `player_link_requests` | `supabase/migrations/`, `src/lib/supabase/`, `src/server/auth/` |
| **Arquitectura Server-First** | Repositorios SSR (`SupabaseTournamentRepository` + `SeedPublicTournamentRepository`), queries cacheadas y Server Actions con guards de rol | `src/server/repositories/`, `src/server/queries/`, `src/server/actions/`, `src/server/admin/` |
| **Motor de reglas & Votación** | Tablas Anual/Histórica, Copa (4/2/0 compañeros y capitanes), Química, Consistencia Wilson (`z = 1.28`), H2H, Pozo, layout táctico y motor de votación transparente | `src/lib/engine/`, `src/lib/matches/`, `src/lib/voting/` |
| **Importador Excel** | Parser de `LOLONMEBOL.xlsx` (filtrando filas resumen como `Rendimientos`/`Total`), normalización de estrellas/alias y motor de diff Dry-Run | `src/lib/excel/`, `src/app/api/import-excel/route.ts` |

---

## 2. Módulos y Rutas Implementadas

| Ruta | Propósito | Funcionalidades clave |
| :--- | :--- | :--- |
| `/` | **Inicio** | Franja compacta de fecha (líder, partidos, próximo evento), pizarrón táctico de anuncios (carrusel), pestañas `Tabla Anual` / `Histórica` / `Copa` arriba del fold, columna `Jugador` sticky y cuadro horizontal de Copa con conectores. |
| `/partidos` | **Historial de Partidos** | Filtros por temporada, competencia (`Liga`, `Copa`, `LOLONMEBOL`, `Fechas especiales`), fecha, N° de fecha y jugador; planillas desplegables con **Pizarra táctica interactiva** (fichas arrastrables restringidas a la mitad de cancha de cada equipo), datos `0G / 0A` en 2026, enlace directo a Admin y **Votación post-partido transparente** (puntajes 1–10 + 1 MVP). |
| `/stats` | **Stats & Lab Grupal** | Selector multi-jugador con buscador, filtro de competencia, toggle `< 3 PJ`, métricas de `Química (%)`, `Wilson CT%`, efectividad `3/1/0` y `4/2/0`, confrontación `V − D` y gráficos `recharts`. |
| `/calendario` | **Calendario Oficial** | Agenda agrupada por mes en español con filtros por temporada y categoría (`Liga`, `Copa`, `LOLONMEBOL`, `F11 Especial`, `Descanso`, `Aplazado`). |
| `/reglas` | **Reglamento** | Consulta directa del reglamento oficial de Liga, Copa, LOLONMEBOL y sistema de puntuación. |
| `/perfil` | **Perfil & Login** | Inicio de sesión con Google OAuth / Magic Link, carnet oficial del jugador vinculado, estadísticas personales, últimos partidos y solicitud de vinculación manual si el email aún no fue precargado. |
| `/blog` | **Blog de Jugadores** | Vista informativa preparada para el foro global por tópicos (Fase 2). |
| `/admin` | **Panel de Administración** | Protegido SSR por rol (`admin` y `authorized`): carga/edición/borrado de partidos, **apertura y cierre de votación post-partido**, anuncios/calendario, editor manual 100% editable de Copa, gestión de jugadores (**precarga de email por jugador** + **cola de aprobación de solicitudes de vinculación** + roles/estrellas), Pozo mensual exclusivo Admin y carga incremental de `LOLONMEBOL.xlsx` con vista previa diff. |

---

## 3. Sistema de Diseño ("Boletín Oficial de Federación en Cancha")

Documentado en [PRODUCT.md](../PRODUCT.md) y [DESIGN.md](../DESIGN.md):

| Eje | Decisión implementada |
| :--- | :--- |
| **Temas (SSR cookie)** | **Estadio Nocturno** (default), **Salvia** y **Diario**, conmutables desde el header sin FOUC. |
| **Paleta de competencias** | Colores exactos del Google Sheets oficial: Liga (`#8E7CC3`), Copa (`#3D85C6`), LOLONMEBOL (`#E06666`), F11 (`#C27BA0`), integrados sobre shell Verde Federación (`#0A4A28`) y Oro Copa (`#E5A00D`). |
| **Tipografía & Ergonomía** | `Archivo` + `Barlow Condensed` (`tabular-nums`), inputs `16px` mobile, navegación inferior fija (`md:hidden`) y barra inline en desktop (`md+`), targets táctiles `>= 40px`. |

---

## 4. Próximos Pasos Pendientes

1. **Bloqueado por asset**:
   - Reemplazar los logos viejos (`Logo.svg` / `LogoLOLONMEBOL.svg`) por el logo nuevo oficial (Issue `#36`).
2. **Postergado por prioridad**:
   - **Edición de perfil de jugador** (permitir que el jugador logueado edite su apodo/avatar/club favorito desde `/perfil`).
3. **Restante de Fase 2 — Comunidad y Media**:
   - **Blog global por tópicos** (`blog_topics`, `blog_comments` ya listos en DB).
   - **Integración de Club Favorito vía API-Football** (`clubs_cache` ya listo en DB).
   - **Galería de fotos por partido vía Cloudinary** (`match_media` ya listo en DB).
4. **Fase 3 — Extras**:
   - Clips cortos de video (R2 / YouTube oculto), confirmación de asistencia ("Voy / No voy") en Calendario y asistente de armado de equipos.
5. **Infraestructura / Ops**:
   - Workflows cron en `.github/workflows/` (keep-alive semanal de Supabase free tier y sync diario de API-Football).
