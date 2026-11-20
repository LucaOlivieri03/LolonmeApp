# Documentación de Negocio y Producto — LolonmeApp (v2 — Definitiva)

> [!NOTE]
> **Estado del documento**: Alcance funcional y decisiones de negocio cerradas. Listo para pasar a diseño técnico e implementación por fases.

---

## 1. Visión del Producto

**LolonmeApp** es el hub digital **mobile-first** (Web App instalable — **PWA**) del torneo de fútbol **LOLONMEBOL**. Sus pilares son:

1. **Gestión centralizada del torneo**: Fechas, formaciones, resultados, Liga, Copa (automática y 100% editable), Final LOLONMEBOL, fechas especiales y Pozo.
2. **Experiencia rica para los jugadores**: Estadísticas personales, filtros grupales avanzados (Química, Consistencia Wilson, Historial H2H), club preferido vía API de fútbol, votación transparente de MVP/calificaciones, blog por tópicos y galería de partidos.
3. **Costo \$0/mes de mantenimiento**, sin tiendas (Play Store / App Store) y con deploy automático.
4. **Continuidad histórica**: Importador constante desde `LOLONMEBOL.xlsx` (2025, 2026 y futuras cargas).
5. **Identidad visual propia**: Basada en el **logo oficial de LOLONMEBOL** (ubicado en `assets/` del repositorio) y la codificación visual del torneo (Liga, Copa, Fechas Especiales y Final LOLONMEBOL).

---

## 2. Roles y Matriz de Permisos (Definitiva)

El **Admin es a su vez Jugador**. Además, puede designar **Jugadores Autorizados** con permisos ampliados de operación semanal.

| Funcionalidad / Módulo | Admin *(también Jugador)* | Jugador Autorizado | Jugador | Invitado *(sin cuenta)* |
| :--- | :---: | :---: | :---: | :---: |
| Ver Main Page (Anuncios, Calendario, Tablas, Cruces de Copa) | Sí | Sí | Sí | **Sí** |
| Ver perfiles, stats personales y filtros grupales de jugadores | Sí | Sí | Sí | **Sí (solo lectura)** |
| Leer el Blog de jugadores | Sí | Sí | Sí | **Sí (solo lectura)** |
| Crear tópicos y participar/comentar en el Blog | Sí + Moderar | Sí | Sí | No |
| Editar su propio perfil y elegir **club preferido** | Sí | Sí | Sí | No |
| Votar **MVP** y **calificaciones** *(solo si jugó el partido)* | Sí | Sí | Sí | No |
| Subir **fotos** (5–15/partido; clips en fase posterior) | Sí + Moderar | Sí | Sí | No |
| Cargar/editar **partidos y rendimientos** (formaciones, goles, notas) | Sí | **Sí** | No | No |
| Gestionar **Tablero de Anuncios y Calendario de Eventos** | Sí | **Sí** | No | No |
| Cerrar votaciones y asignar **MVP oficial** *(con override)* | **Sí** | No | No | No |
| Generar y **editar manualmente el cuadro de Copa** (todas las rondas) | **Sí** | No | No | No |
| Gestionar **jugadores** (alta con email, roles, estrellas/títulos) | **Sí** | No | No | No |
| **Importador constante desde Excel** | **Sí** | No | No | No |
| **Pozo y Premios** (cuotas, gastos, rendimientos, saldo) | **Sí (exclusivo)** | No | No | No |

### Flujo de alta y vinculación de jugadores
1. El Admin crea la ficha del jugador indicando su **Nombre** y **Email** (asociado a su historial importado de 2025/2026).
2. El jugador ingresa a la PWA y se registra con ese mismo email (Google o email/contraseña).
3. El sistema vincula automáticamente su cuenta con su ficha e historial completo.
4. En su primer ingreso, el jugador elige su **club preferido** y personaliza su perfil.

---

## 3. Módulos y Alcance Funcional

### 3.1 Main Page (Inicio Mobile-First)
- **Header con Logo oficial de LOLONMEBOL** (desde `assets/`).
- **Tablero de Anuncios**: Comunicados y avisos fijados (gestionado por Admin y Jugadores Autorizados).
- **Calendario de Eventos (informativo en Fase 1)**: Vista mensual/agenda con etiquetas de color (`Liga`, `Copa`, `Final LOLONMEBOL`, `F11 Especial`, `Descanso`, `Aplazado`).
- **Tablas de Posiciones**: Selector rápido entre **Tabla Anual** (temporada activa) y **Tabla Histórica** (acumulado total), con desempates oficiales y zonas de clasificación a Copa.
- **Cruces de Copa y Final LOLONMEBOL**: Cuadro visual interactivo (Fase Previa → Cuartos → Semis → Final → LOLONMEBOL), generado automáticamente y **editable manualmente por el Admin** en todas sus instancias (ida y vuelta, puntajes, bajas y reemplazos).
- **Clubes Preferidos**: Resumen de resultados recientes / próximos partidos de los clubes elegidos por los jugadores.

### 3.2 Partidos, Votación Transparente y Fechas Especiales
- **Detalle de fecha (Liga / Copa)**: Fecha, modalidad (`F5`/`F6`/`F7`), equipos, marcador, capitanes de Copa (si aplica), goles, asistencias, calificaciones, MVP y galería de fotos.
- **Votación de MVP y Calificaciones**:
  - Habilitada **exclusivamente para los jugadores que disputaron ese partido**.
  - **Cierre manual por el Admin**.
  - **Transparencia total**: una vez cerrada, todos pueden ver el detalle/desglose de votos y promedios.
  - **Override de MVP**: el Admin puede asignar el MVP oficial a un jugador distinto del ganador de la votación si corresponde.
- **Sección aparte de Fechas Especiales**: Historial dedicado para eventos fuera de Liga (*F11 Aniversario*, *F11 Oktubre*, *F11 Despedida*), con soporte de flag configurable para excepciones como `F11 Aniversario 2025`.
- **Media del partido**: 5 a 15 fotos por fecha (Fase 2); clips cortos de video (Fase 3).

### 3.3 Hub de Jugadores y Estadísticas Grupales
- **Perfil de Jugador**: Avatar, estrellas (`⭐`), **club preferido** (escudo, último resultado y próximo partido vía API), estadísticas de temporada e históricas (`Pts`, `PJ`, `PG%`, `MVPs`, `G`, `A`, `G/A`, calificación promedio y evolución).
- **Filtros Grupales**: Por **jugador(es)**, **temporada / histórico** y **modalidad (`F5`/`F6`/`F7`)**:
  - **Química (%)** y **Consistencia Wilson (`CT%`)** entre compañeros (más toggle opcional de efectividad `3/1/0`).
  - **Historial mano a mano (`V − D`)** como rivales.
  - Análisis de subgrupos (ej. rendimiento cuando juegan juntos 2, 3 o más jugadores específicos).

### 3.4 Blog de Jugadores
- **Una sola pestaña global** con **tópicos creados por los usuarios** (sin feed individual por jugador).
- Los jugadores crean tópicos y comentan; invitados leen sin participar; el Admin modera.

### 3.5 Panel de Administración y Operación
- **Carga de partidos y rendimientos** *(Admin + Jugadores Autorizados)*.
- **Anuncios y Calendario** *(Admin + Jugadores Autorizados)*.
- **Editor completo de Cuadro de Copa** *(solo Admin)*: generar llaves por tabla + editar cruces, ida/vuelta, puntajes y reemplazos por baja.
- **Pozo y Premios** *(solo Admin)*: cuotas mensuales con monto configurable por mes, gastos/premios, rendimientos y saldo automático.
- **Importador Constante desde Excel** *(solo Admin)*: carga recurrente de `LOLONMEBOL.xlsx` con normalización automática de nombres/emojis y pantalla de vista previa (diff) antes de confirmar cambios.

---

## 4. Stack Tecnológico (Costo \$0/mes)

| Capa | Tecnología | Plan gratuito y estrategia |
| :--- | :--- | :--- |
| **App Mobile-First (PWA)** | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui | Instalable en Android/iOS sin costos de tiendas. |
| **Hosting & Deploy** | Vercel (Hobby Plan) | \$0/mes, deploy automático desde GitHub (`LucaOlivieri03/LolonmeApp`). |
| **Base de Datos + Auth** | Supabase (Free Tier — PostgreSQL) | 500 MB DB + Auth + RLS por roles. Cron semanal gratuito en GitHub Actions para evitar pausa por inactividad. |
| **Fotos (Fase 2)** | Cloudinary (Free Tier) | 25 créditos/mes con compresión WebP automática (ideal para 5–15 fotos/partido). |
| **Videos cortos (Fase 3)** | Cloudflare R2 (10 GB gratis, \$0 egreso) o embeds YouTube No Listado | Cero costos de ancho de banda. |
| **API de Fútbol** | API-Football (API-Sports Free: 100 req/día) | Liga Argentina, Libertadores y ligas mundiales, **cacheado en Supabase** (1–2 consultas/día por clubes activos). |

---

## 5. Hoja de Ruta por Fases

1. **Fase 1 — MVP Core**:
   - Auth + Roles (`admin`, `autorizado`, `jugador`, `invitado` público) + vinculación automática por email.
   - Identidad visual con logo oficial (`assets/`).
   - Importador constante desde `LOLONMEBOL.xlsx` (migración inicial 2025/2026 + re-importaciones).
   - Main Page (Anuncios, Calendario con etiquetas, Tabla Anual e Histórica, Cruces de Copa editables).
   - Carga/edición de partidos, rendimientos, Fechas Especiales, Hub de Jugadores, Química/Consistencia/Historial y Pozo (Admin).
2. **Fase 2 — Comunidad, Votaciones, API y Fotos**:
   - Votación transparente de MVP y Calificaciones (solo participantes, cierre y override del Admin).
   - Blog global por tópicos.
   - Integración de Club Preferido (API-Football con caché en Supabase).
   - Galería de fotos por partido (5–15 fotos en Cloudinary).
3. **Fase 3 — Media avanzada y Extras**:
   - Clips cortos de video por partido (Cloudflare R2 / YouTube).
   - Confirmación de asistencia en calendario ("Voy / No voy") y asistente de armado de equipos.
