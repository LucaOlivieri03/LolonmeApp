# LolonmeApp — Torneo Oficial LOLONMEBOL

Aplicación web mobile-first para gestionar el torneo LOLONMEBOL: Tabla Anual e Histórica, Copa LOLONMEBOL, Laboratorio de Estadísticas, Calendario, Reglas y Administración.

## Inicio rápido

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Configurar variables de entorno copiando `.env.example` a `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
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
| `npm test` | Suite unitaria e integración de motor, Excel y mappers SQL (`vitest run`) |
| `npm run build` | Compilación de producción de Next.js |
