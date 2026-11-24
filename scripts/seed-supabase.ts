import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { TournamentDataset } from "../src/lib/types/domain";
import {
  createSupabaseSeedClient,
  mapDatasetToDatabaseRows,
  syncDatasetToSupabase,
} from "../src/server/db";

function loadLocalEnvFiles() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx <= 0) continue;

      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key] && value !== "") {
        process.env[key] = value;
      }
    }
  }
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const seedPath = path.resolve(process.cwd(), "src/lib/data/seed-data.json");

  if (!fs.existsSync(seedPath)) {
    console.error(
      `Seed dataset not found at ${seedPath}. Run "npm run seed:excel" first.`
    );
    process.exit(1);
  }

  const dataset = JSON.parse(
    fs.readFileSync(seedPath, "utf8")
  ) as TournamentDataset;

  if (isDryRun) {
    const rows = mapDatasetToDatabaseRows(dataset);
    console.log("Dry-run validated PostgreSQL seed payload:");
    for (const [table, list] of Object.entries(rows)) {
      console.log(`  - ${table}: ${list.length} rows`);
    }
    return;
  }

  loadLocalEnvFiles();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment (.env.local)."
    );
    console.error(
      'Tip: run "npm run db:seed:dry" to validate the SQL payload locally without credentials.'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const client = createSupabaseSeedClient(supabase);
  const summary = await syncDatasetToSupabase(client, dataset);

  console.log("Successfully synchronized dataset to Supabase PostgreSQL:");
  for (const [table, count] of Object.entries(summary)) {
    console.log(`  - ${table}: ${count} upserted`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
