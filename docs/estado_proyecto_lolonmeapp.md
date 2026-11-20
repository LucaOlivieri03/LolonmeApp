# Estado del Proyecto — LolonmeApp (LOLONMEBOL)

**LolonmeApp** completó la **Fase 1 (MVP Core)** y el **rework estético integral ("Boletín Oficial de Federación en Cancha")**. La aplicación corre como Web App instalable (PWA) mobile-first con motor de cálculo validado contra el Excel histórico oficial (`2025` y `2026`), las 6 rutas funcionales, panel de administración por roles, gráficos estadísticos reales y sistema de diseño documentado.

---

## Inicio rápido

1. Instalar dependencias: `pnpm install`
2. Levantar entorno de desarrollo: `pnpm dev` → abrir `http://localhost:3000`
3. Validar calidad: `pnpm typecheck && pnpm test && pnpm build`

> [!NOTE]
> Sin variables de Supabase configuradas (`.env.local`), la app opera en **Modo Local** usando el snapshot oficial `src/lib/data/seed-data.json` persistido en `localStorage`, con simulador de roles en `/admin` para pruebas.

---

## 1. Arquitectura y Stack ($0/mes)

| Capa | Implementación actual | Archivos clave |
| :--- | :--- | :--- |
| **Framework & UI** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide, Recharts | `package.json`, `src/app/layout.tsx`, `src/app/globals.css` |
| **PWA & Media** | Manifest instalable, Service Worker, escudos SVG y reproductor de himno (`0:10–0:21` / completo) | `public/manifest.json`, `public/sw.js`, `src/components/layout/AnthemPlayer.tsx` |
| **Base de datos & Auth** | Esquema PostgreSQL + políticas RLS por roles en Supabase (`admin`, `authorized`, `player`, `guest`) | `supabase/migrations/`, `src/lib/supabase/` |
| **Estado local / híbrido** | `TournamentProvider` con fallback local automático y recálculo reactivo | `src/components/providers/TournamentProvider.tsx` |
| **Motor de reglas** | Tablas Anual/Histórica, Copa, Química, Consistencia Wilson (`z = 1.28`), H2H y Pozo | `src/lib/engine/` |
| **Importador Excel** | Parser de `LOLONMEBOL.xlsx`, normalización de estrellas/alias y motor de diff Dry-Run | `src/lib/excel/`, `src/app/api/import-excel/route.ts` |

---

## 2. Módulos y Rutas Implementadas

| Ruta | Propósito | Funcionalidades clave |
| :--- | :--- | :--- |
| `/` | **Inicio** | Franja compacta de fecha (líder, partidos, próximo evento), pestañas `Tabla Anual` / `Histórica` / `Copa` arriba del fold, columna `Jugador` sticky, cuadro horizontal de Copa con conectores y Tablero de Anuncios. |
| `/partidos` | **Historial de Partidos** | Filtros por temporada y competencia (`Liga`, `Desempate`, `Copa`, `Fechas Especiales`, `Final LOLONMEBOL`), fechas en español y planillas desplegables por equipo (`CAP`, `MVP`, `G/A`, calificación). |
| `/stats` | **Stats & Lab Grupal** | Selector multi-jugador con buscador, métricas de `Química (%)`, `Wilson CT%`, toggle `Efectividad 3/1/0`, confrontación `V − D` y gráficos `recharts` en Lab y Perfil de Jugador. |
| `/calendario` | **Calendario Oficial** | Agenda agrupada por mes en español con filtros por temporada y categoría (`Liga`, `Copa`, `Final LOLONMEBOL`, `F11 Especial`, `Descanso`, `Aplazado`). |
| `/blog` | **Blog de Jugadores** | Vista informativa preparada para el foro global por tópicos de Fase 2. |
| `/admin` | **Panel de Administración** | Controlado por roles (`admin` y `authorized`): carga/borrado de partidos con confirmación en dos pasos, anuncios/calendario, editor manual 100% editable de Copa, alta de jugadores/estrellas/roles, Pozo mensual con tabla sticky y carga incremental de `LOLONMEBOL.xlsx` con vista previa diff. |

---

## 3. Rework Estético Anti-Slop y Sistema de Diseño

El sistema abandonó la estética genérica de tarjetas SaaS para adoptar la identidad **Boletín Oficial de Federación en Cancha**, documentada en [PRODUCT.md](../PRODUCT.md) y [DESIGN.md](../DESIGN.md):

| Eje | Decisión implementada |
| :--- | :--- |
| **Paleta** | Papel marfil técnico (`#F6F5F0`), superficies planas con filetes `1px` (`#D6D3C7`), shell **Verde Federación (`#0A4A28`)** con geometría de líneas de cancha y filete **Oro Copa (`#E5A00D`)**, más **Naranja Cuero (`#C86E0E` / `#E68E23`)** tomado de `Logo.svg`. |
| **Tipografía** | `Archivo` para UI/tablas densas + `Barlow Condensed` con `tabular-nums` para dorsales, puntajes y marcadores. Inputs en `16px` mobile para evitar auto-zoom en iOS Safari. |
| **Ergonomía mobile** | Navegación inferior exclusiva de mobile (`md:hidden`) y barra superior inline en desktop (`md+`), targets táctiles `>= 40px`, columnas sticky en tablas anchas y confirmaciones en dos pasos para acciones destructivas. |
| **Artefactos de diseño** | `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.impeccable/config.json`, `.impeccable/live/config.json` y `.impeccable/surfaces/app-shell.md`. |

---

## 4. Verificación Realizada

- [x] `pnpm typecheck` (`tsc --noEmit`): sin errores.
- [x] `pnpm test` (`vitest run`): **11/11 tests pasando** (`src/lib/engine/engine.test.ts` + validación cruzada contra `docs/LOLONMEBOL.xlsx` en `src/lib/excel/excel.test.ts`).
- [x] `pnpm build` (`next build`): compilación, lint y generación de las 10 rutas sin errores.
- [x] Inspección visual en navegador sobre `http://localhost:3000` en desktop (`1280×800`) y mobile (`390×844`): sin errores de consola, sin overflow horizontal, gráficos `recharts` renderizados y cuadro de Copa ajustado al viewport desktop.

---

## 5. Próximos Pasos

1. **Vista de Partido con Formación en Campo de Juego**: Pantalla dedicada de detalle de partido con representación táctica sobre cancha real (acordada para la próxima iteración).
2. **Limpieza menor del seed Excel**: Filtrar las filas resumen `"Rendimientos"` y `"Total"` durante el parseo de jugadores en `src/lib/excel/parser.ts`.
3. **Fase 2 — Comunidad, Votaciones y Media**:
   - Conexión a Supabase en producción + vinculación automática por email.
   - Votación transparente de MVP y calificaciones (solo participantes, cierre y override del Admin).
   - Blog global por tópicos, integración de Club Preferido (API-Football cacheado en Supabase) y galería de fotos en Cloudinary.
