import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import seedData from "@/lib/data/seed-data.json";
import { computeStandings } from "@/lib/engine";
import { computeImportDiff } from "@/lib/excel";
import type { TournamentDataset } from "@/lib/types/domain";
import {
  deterministicUuid,
  mapDatabaseRowsToDataset,
  mapDatasetToDatabaseRows,
} from "@/server/db/mappers";
import { syncDatasetToSupabase, type SeedTableClient } from "@/server/db/seed-sync";

const SEED_DATASET = seedData as unknown as TournamentDataset;
const UUID_V5_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createInMemorySupabaseMock(initialTables?: Record<string, Record<string, unknown>[]>) {
  const store = new Map<string, Record<string, unknown>[]>(
    Object.entries(initialTables ?? {})
  );

  const client: SeedTableClient = {
    async selectAll(table, columns) {
      void columns;
      return [...(store.get(table) ?? [])];
    },
    async upsertRows(table, rows, onConflict) {
      const conflictCols = onConflict.split(",").map((c) => c.trim());
      const current = [...(store.get(table) ?? [])];

      for (const incoming of rows) {
        const matchIdx = current.findIndex((existing) =>
          conflictCols.every((col) => existing[col] === incoming[col])
        );

        if (matchIdx >= 0) {
          // PostgREST upsert semantics: update only keys present in incoming payload
          current[matchIdx] = {
            ...current[matchIdx],
            ...incoming,
          };
        } else {
          current.push({ ...incoming });
        }
      }

      store.set(table, current);
    },
  };

  return { store, client };
}

describe("WU-1: PostgreSQL Schema Alignment, Domain Mappers & Idempotent Seed", () => {
  it("defines 0002 migration aligning result_outcome, players.slug, and natural external keys", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/0002_align_domain_and_historical_outcomes.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/ALTER TABLE public\.matches[\s\S]*result_outcome/i);
    expect(sql).toMatch(/result_outcome IN \('A', 'B', 'draw'\)/);
    expect(sql).toMatch(/ALTER TABLE public\.players[\s\S]*slug/i);
    expect(sql).toMatch(/UNIQUE[\s\S]*slug/i);
  });

  it("roundtrips the full historical dataset through SQL rows with 100% standings & Excel diff parity", () => {
    const rows = mapDatasetToDatabaseRows(SEED_DATASET);

    // Every SQL table uses valid deterministic UUIDv5 primary keys
    expect(rows.seasons.length).toBe(SEED_DATASET.seasons.length);
    expect(rows.players.length).toBe(SEED_DATASET.players.length);
    expect(rows.matches.length).toBe(SEED_DATASET.matches.length);
    expect(rows.seasons.every((s) => UUID_V5_REGEX.test(s.id))).toBe(true);
    expect(rows.players.every((p) => UUID_V5_REGEX.test(p.id))).toBe(true);
    expect(rows.matches.every((m) => UUID_V5_REGEX.test(m.id))).toBe(true);

    // Historical 2025 matches without exact scores preserve result_outcome
    const scorelessWithOutcome = rows.matches.filter(
      (m) => m.team_a_score === null && m.team_b_score === null && m.result_outcome !== null
    );
    expect(scorelessWithOutcome.length).toBeGreaterThan(0);

    const reconstructed = mapDatabaseRowsToDataset(rows);

    // 100% parity across Annual 2025, Annual 2026, and Historical standings
    for (const seasonId of ["season-2025", "season-2026", undefined]) {
      const expectedStandings = computeStandings({
        players: SEED_DATASET.players,
        matches: SEED_DATASET.matches,
        titles: SEED_DATASET.titles,
        seasonId,
      });
      const actualStandings = computeStandings({
        players: reconstructed.players,
        matches: reconstructed.matches,
        titles: reconstructed.titles,
        seasonId,
      });
      expect(actualStandings).toEqual(expectedStandings);
    }

    // Zero false-positive diffs when comparing reconstructed DB state with Excel seed
    const diff = computeImportDiff(reconstructed, SEED_DATASET);
    expect(diff.newPlayers).toHaveLength(0);
    expect(diff.newMatches).toHaveLength(0);
    expect(diff.updatedMatches).toHaveLength(0);
    expect(diff.unchangedMatchesCount).toBe(SEED_DATASET.matches.length);
  });

  it("produces deterministic UUIDs and executes idempotent sync while preserving linked auth users", async () => {
    expect(deterministicUuid("player:b-aguzzi")).toBe(
      deterministicUuid("player:b-aguzzi")
    );
    expect(deterministicUuid("player:b-aguzzi")).not.toBe(
      deterministicUuid("player:pipo")
    );

    const preExistingPlayerUuid = "11111111-2222-4333-8444-555555555555";
    const linkedAuthUserId = "99999999-8888-4777-8666-555555555555";

    const { store, client } = createInMemorySupabaseMock({
      players: [
        {
          id: preExistingPlayerUuid,
          slug: "b-aguzzi",
          user_id: linkedAuthUserId,
          email: "aguzzi@lolonmebol.com",
          display_name: "B. Aguzzi",
          nickname: null,
          avatar_url: null,
          role: "admin",
          favorite_club_id: 12,
          is_active: true,
        },
      ],
    });

    const firstSummary = await syncDatasetToSupabase(client, SEED_DATASET);
    const countsAfterFirstRun = Object.fromEntries(
      Array.from(store.entries()).map(([k, v]) => [k, v.length])
    );

    // Re-running seed a second time must be 100% idempotent (zero duplicate rows)
    const secondSummary = await syncDatasetToSupabase(client, SEED_DATASET);
    const countsAfterSecondRun = Object.fromEntries(
      Array.from(store.entries()).map(([k, v]) => [k, v.length])
    );

    expect(secondSummary).toEqual(firstSummary);
    expect(countsAfterSecondRun).toEqual(countsAfterFirstRun);
    expect(countsAfterSecondRun.players).toBe(SEED_DATASET.players.length);
    expect(countsAfterSecondRun.matches).toBe(SEED_DATASET.matches.length);
    expect(countsAfterSecondRun.fund_payments).toBe(SEED_DATASET.fundPayments.length);

    // Existing Auth linkage, UUID, role, email, and favorite club must remain intact
    const aguzziRow = store.get("players")?.find((p) => p.slug === "b-aguzzi");
    expect(aguzziRow).toMatchObject({
      id: preExistingPlayerUuid,
      user_id: linkedAuthUserId,
      email: "aguzzi@lolonmebol.com",
      role: "admin",
      favorite_club_id: 12,
    });

    // Foreign keys in match_players and player_titles for b-aguzzi must point to preExistingPlayerUuid
    const aguzziTitles = (store.get("player_titles") ?? []).filter(
      (t) => t.player_id === preExistingPlayerUuid
    );
    expect(aguzziTitles.length).toBeGreaterThan(0);
  });

  it("coerces PostgreSQL numeric string columns cleanly back to finite numbers", () => {
    const rows = mapDatasetToDatabaseRows(SEED_DATASET);
    const stringifiedRows = {
      ...rows,
      match_players: rows.match_players.map((mp, idx) => ({
        ...mp,
        admin_rating: idx === 0 ? "8.75" : mp.admin_rating,
      })),
      fund_months: rows.fund_months.map((fm) => ({
        ...fm,
        fee_amount: String(fm.fee_amount),
      })),
      fund_transactions: rows.fund_transactions.map((tx) => ({
        ...tx,
        amount: String(tx.amount),
      })),
    };

    const dataset = mapDatabaseRowsToDataset(stringifiedRows);
    expect(typeof dataset.matches[0]?.players[0]?.adminRating).toBe("number");
    expect(dataset.matches[0]?.players[0]?.adminRating).toBe(8.75);
    expect(dataset.fundMonths.every((m) => typeof m.feeAmount === "number")).toBe(
      true
    );
    expect(
      dataset.fundTransactions.every((tx) => typeof tx.amount === "number")
    ).toBe(true);
  });
});
