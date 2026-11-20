# Plan Técnico y Arquitectura — LolonmeApp

> [!NOTE]
> Documento técnico de referencia basado en el reglamento definitivo (`docs/reglas_torneo_lolonmebol.md`) y la documentación de negocio (`docs/documentacion_negocio_lolonmebol.md`). No contiene código ejecutable todavía; sirve como plano para iniciar la **Fase 1**.

---

## 1. Arquitectura General (Costo \$0/mes)

```mermaid
flowchart TD
    U["Usuario Mobile / Desktop<br/>(PWA instalable)"] --> V["Vercel (Next.js App Router)<br/>UI Mobile-First + Route Handlers"]
    V --> SB["Supabase<br/>PostgreSQL + Auth + RLS"]
    V --> CL["Cloudinary<br/>(Fotos de partidos - Fase 2)"]
    V --> AF["API-Football<br/>(Caché en Supabase - Fase 2)"]
    GA["GitHub Actions (Cron gratis)<br/>• Keep-alive Supabase<br/>• Sync diario Clubes Preferidos"] --> V
```

- **Frontend / Full-stack**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, TanStack Table, `manifest.json` + service worker ligero para PWA.
- **Identidad visual**: Logo oficial importado desde `assets/` (colocado en `public/assets/` para íconos PWA, favicon y header).
- **Seguridad por roles**: **Row Level Security (RLS)** en PostgreSQL (Supabase) + validación en Server Actions / Route Handlers. Los invitados acceden sin login a las vistas públicas de solo lectura; el módulo de **Pozo** tiene RLS estricto `role = 'admin'`.

---

## 2. Modelo de Datos (PostgreSQL / Supabase)

### 2.1 Usuarios, Jugadores y Títulos
- **`players`**: `id`, `user_id` (nullable, se vincula automáticamente al registrarse con el mismo email), `email` (unique, nullable para invitados históricos), `display_name`, `nickname`, `avatar_url`, `role` (`admin` | `authorized` | `player`), `favorite_club_id`, `is_active`, `created_at`.
- **`player_aliases`**: `id`, `player_id`, `raw_name` — mapea variantes del Excel (ej. `B. Aguzzi ⭐⭐⭐`, `B. Aguzzi ⭐️⭐️⭐️`, `Pipo ⭐`) al mismo `player_id` para el importador constante.
- **`player_titles`**: `id`, `player_id`, `season_id`, `title_type` (`league` | `cup` | `lolonmebol`), `awarded_at` — cada fila equivale a `1 ⭐` en el perfil.

### 2.2 Temporadas, Calendario y Anuncios
- **`seasons`**: `id`, `year` (2025, 2026...), `name`, `status` (`active` | `finished`), `cup_cutoff_date`.
- **`calendar_events`**: `id`, `season_id`, `title`, `description`, `event_date`, `event_type` (`league` | `cup` | `lolonmebol` | `special_f11` | `rest` | `postponed`), `match_id` (nullable), `created_by`.
- **`announcements`**: `id`, `title`, `body`, `is_pinned`, `created_by`, `created_at`, `updated_at`.

### 2.3 Partidos, Participaciones y Votaciones
- **`matches`**:
  - `id`, `season_id`, `match_number` (nullable para F11), `match_date`, `match_type` (`league` | `cup` | `lolonmebol` | `special_f11` | `league_tiebreaker`), `modality` (`F5` | `F6` | `F7` | `F11`), `team_a_score`, `team_b_score`.
  - Flags configurables para excepciones: `counts_for_league` (bool), `counts_for_stats` (bool) — permite manejar `F11 Aniversario 2025` sin lógica hardcodeada.
  - Votación: `voting_status` (`open` | `closed`), `voting_closed_at`, `voting_closed_by`.
  - Sincronización Excel: `external_source_key` (para detectar actualizaciones en el importador constante).
- **`match_players`**:
  - `id`, `match_id`, `player_id`, `team` (`A` | `B`), `is_cup_captain` (bool), `goals`, `assists`, `admin_rating` (numeric, nullable), `is_mvp` (bool — oficial, con soporte de override y MVP compartido).
- **`match_votes`** *(Fase 2 — transparente)*:
  - `id`, `match_id`, `voter_player_id` *(validado: debe existir en `match_players` de ese partido)*, `target_player_id`, `rating` (numeric 1–10), `voted_mvp` (bool), `created_at`.

### 2.4 Motor de Copa (Automático + 100% Editable)
- **`cup_editions`**: `id`, `season_id`, `name`, `cutoff_snapshot_json` *(guarda el orden de la tabla al momento del corte para la ventaja deportiva)*.
- **`cup_ties`**:
  - `id`, `cup_edition_id`, `round` (`preliminary` | `quarterfinal` | `semifinal` | `final` | `lolonmebol`), `slot_order`.
  - `player_a_id`, `player_b_id` *(editables por Admin para bajas/reemplazos)*.
  - `seed_a`, `seed_b` *(para ventaja deportiva en empate global)*.
  - `leg1_match_id`, `leg2_match_id` *(nullable)*.
  - `override_score_a`, `override_score_b` *(nullable — permite al Admin ajustar puntaje si hace falta)*.
  - `winner_player_id` *(calculado automáticamente o sobreescrito por Admin)*, `notes` *(ej. "Baja de Porpo por lesión, ingresa Pedro")*.

### 2.5 Pozo y Premios (Solo Admin — RLS estricto)
- **`fund_months`**: `id`, `season_id`, `month_number`, `month_label`, `fee_amount` *(cuota configurable por mes)*.
- **`fund_payments`**: `id`, `fund_month_id`, `player_id`, `paid` (bool), `paid_at`.
- **`fund_transactions`**: `id`, `season_id`, `tx_type` (`expense` | `yield`), `amount`, `description`, `tx_date`.

### 2.6 Blog, Media y API de Fútbol (Fase 2–3)
- **`blog_topics`**: `id`, `title`, `body`, `category_tag`, `author_player_id`, `is_pinned`, `created_at`.
- **`blog_comments`**: `id`, `topic_id`, `author_player_id`, `body`, `created_at`.
- **`match_media`**: `id`, `match_id`, `media_type` (`photo` | `video`), `url`, `uploaded_by`, `created_at`.
- **`clubs_cache`**: `club_id`, `name`, `logo_url`, `league_name`, `last_match_json`, `next_match_json`, `synced_at`.

---

## 3. Motores de Cálculo (SQL Views / Funciones en TypeScript)

1. **Tabla Anual e Histórica**:
   - Calcula `Pts` (`3/1/0` Liga y desempate; `4/2/0` compañeros en Copa; `0` capitanes en Copa y Final LOLONMEBOL), `PJ`, `PG`, `PE`, `PP`, `PG%`, `MVPs`, `G`, `A`, `G/A`, `Calificación Promedio`.
   - Aplica la cadena exacta de desempates: `Pts ↓` → `PJ ↑` → `H2H directo ↓` → `PG% ↓` → `MVPs ↓` → `Nombre ↑`.
   - Señala automáticamente si existe empate en puntos entre `1.°` y `2.°` al cierre de temporada para habilitar el **Partido Desempate de Liga**.
2. **Motor de Copa**:
   - Al generar la Copa: toma los 2 finalistas de la LOLONMEBOL anterior + completa con el Top de la tabla al corte hasta 9 jugadores; coloca en **Fase Previa** a los 2 últimos clasificados que no sean dichos finalistas, y arma Cuartos (`1° vs GFP`, `2° vs 7°`, `3° vs 6°`, `4° vs 5°`).
   - Cada llave permite **edición manual total** por el Admin (cambiar jugador por baja, editar marcador global o elegir ganador).
3. **Química, Consistencia Wilson e Historial H2H**:
   - Calculados dinámicamente desde `match_players` + `matches` (donde `counts_for_stats = true`), filtrables por **temporada o histórico**, **modalidad (`F5`/`F6`/`F7`)** y **subconjunto de jugadores**.
   - Implementa la fórmula exacta de Wilson ($z = 1.28$) y un toggle opcional de *Efectividad 3/1/0*.

---

## 4. Diseño del Importador Constante de Excel

- **Entrada**: Archivo `.xlsx` con el formato actual de `LOLONMEBOL.xlsx` (`Fechas XX`, `Liga XX y Copa XX`, `Rendimientos XX`, `Pozo y premios XX`).
- **Flujo en 3 pasos (Admin)**:
  1. **Parseo y normalización**: Lee hojas en el servidor (`xlsx` / `exceljs`), limpia emojis/espacios y resuelve nombres contra `player_aliases`.
  2. **Vista previa (Dry-Run / Diff)**: Muestra cuántos partidos son **nuevos**, cuántos tienen **cambios** respecto a la DB, y si hay **jugadores nuevos** o **conflictos** (el Admin decide si sobrescribir o conservar lo editado en la app).
  3. **Confirmación transaccional**: Inserta/actualiza en bloque y recalcula automáticamente tablas, química y consistencia.

---

## 5. Mapa de Navegación Mobile-First (Bottom Navigation)

Barra inferior fija con 5 accesos principales (en mobile):

1. **Inicio**: Anuncios + Próximo evento + Tabs rápidos (**Tabla Anual** / **Histórica** / **Copa** / **Clubes**).
2. **Partidos**: Listado por temporada + filtro `Liga / Copa / Fechas Especiales` + detalle de fecha (equipos, G/A, votación transparente, fotos).
3. **Stats**: Perfil personal + **Laboratorio Grupal** (Química, Consistencia Wilson, Historial H2H y filtro de subgrupos).
4. **Blog**: Listado de tópicos comunitarios + creación de tópico y comentarios.
5. **Calendario / Más**: Calendario mensual con etiquetas + acceso a **Panel Admin** (si tiene rol `admin` o `authorized`) + Perfil/Login.

---

## 6. Estructura Inicial Propuesta del Repositorio

```text
LolonmeApp/
├── assets/                     # Logo oficial de LOLONMEBOL (local del usuario)
├── docs/
│   ├── documentacion_negocio_lolonmebol.md
│   ├── reglas_torneo_lolonmebol.md
│   └── plan_tecnico_lolonmebol.md
├── public/                     # Manifest PWA, íconos y logo público (Fase 1)
├── src/
│   ├── app/                    # Next.js App Router (páginas y API routes)
│   ├── components/             # UI mobile-first (shadcn/ui)
│   ├── lib/
│   │   ├── supabase/           # Clientes server/browser y tipos DB
│   │   ├── engine/             # Motores puros: tabla, copa, química, Wilson
│   │   └── excel/              # Parser e importador constante de LOLONMEBOL.xlsx
└── supabase/
    └── migrations/             # SQL de tablas, índices y políticas RLS
```
