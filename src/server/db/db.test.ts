import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import seedData from "@/lib/data/seed-data.json";
import { computeStandings } from "@/lib/engine";
import { applyImportDiff, computeImportDiff } from "@/lib/excel";
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
    expect(sql).toMatch(/ALTER TABLE public\.players[\s\S]*political_orientation/i);
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
          political_orientation: "Centro",
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

    // Existing Auth linkage, UUID, role, email, favorite club, and political orientation must remain intact
    const aguzziRow = store.get("players")?.find((p) => p.slug === "b-aguzzi");
    expect(aguzziRow).toMatchObject({
      id: preExistingPlayerUuid,
      user_id: linkedAuthUserId,
      email: "aguzzi@lolonmebol.com",
      role: "admin",
      favorite_club_id: 12,
      political_orientation: "Centro",
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

const TABLE_UNIQUE_CONSTRAINTS: Record<string, string[][]> = {
  seasons: [["id"], ["year"]],
  players: [["id"], ["slug"], ["user_id"], ["email"]],
  player_aliases: [["id"], ["raw_name"]],
  player_titles: [["id"], ["player_id", "season_id", "title_type"]],
  matches: [["id"], ["slug"], ["external_source_key"]],
  match_players: [["id"], ["match_id", "player_id"]],
  calendar_events: [["id"], ["external_key"]],
  announcements: [["id"], ["external_key"]],
  cup_editions: [["id"], ["season_id"]],
  cup_ties: [["id"], ["cup_edition_id", "round", "slot_order"]],
  fund_months: [["id"], ["season_id", "month_number"]],
  fund_payments: [["id"], ["fund_month_id", "player_id"]],
  fund_transactions: [["id"], ["external_key"]],
};

function tupleMatchesNonNull(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  cols: string[]
): boolean {
  return cols.every((col) => {
    const va = a[col];
    const vb = b[col];
    if (va === null || va === undefined || vb === null || vb === undefined) {
      return false;
    }
    return va === vb;
  });
}

function createPgFaithfulSupabaseMock(
  initialTables?: Record<string, Record<string, unknown>[]>
) {
  const store = new Map<string, Record<string, unknown>[]>(
    Object.entries(initialTables ?? {}).map(([k, v]) => [
      k,
      v.map((r) => ({ ...r })),
    ])
  );

  const client: SeedTableClient = {
    async selectAll(table) {
      return (store.get(table) ?? []).map((r) => ({ ...r }));
    },
    async upsertRows(table, rows, onConflict) {
      const conflictCols = onConflict.split(",").map((c) => c.trim());
      const uniqueSpecs = TABLE_UNIQUE_CONSTRAINTS[table] ?? [["id"]];

      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (tupleMatchesNonNull(rows[i], rows[j], conflictCols)) {
            throw new Error(
              `21000: ON CONFLICT DO UPDATE command cannot affect row a second time on ${table} (${onConflict})`
            );
          }
        }
      }

      const current = (store.get(table) ?? []).map((r) => ({ ...r }));

      for (const incoming of rows) {
        const conflictIdx = current.findIndex((existing) =>
          tupleMatchesNonNull(existing, incoming, conflictCols)
        );

        if (conflictIdx >= 0) {
          const updated = { ...current[conflictIdx], ...incoming };
          for (const uCols of uniqueSpecs) {
            const otherIdx = current.findIndex(
              (existing, idx) =>
                idx !== conflictIdx &&
                tupleMatchesNonNull(existing, updated, uCols)
            );
            if (otherIdx >= 0) {
              throw new Error(
                `23505: duplicate key value violates unique constraint on ${table} (${uCols.join(",")})`
              );
            }
          }
          current[conflictIdx] = updated;
        } else {
          for (const uCols of uniqueSpecs) {
            const otherIdx = current.findIndex((existing) =>
              tupleMatchesNonNull(existing, incoming, uCols)
            );
            if (otherIdx >= 0) {
              throw new Error(
                `23505: duplicate key value violates unique constraint on ${table} (${uCols.join(",")})`
              );
            }
          }
          current.push({ ...incoming });
        }
      }

      store.set(table, current);
    },
  };

  return { store, client };
}

describe("WU-1 Verification Probes (B1-B4)", () => {
  it("Probe 1 (B1): syncDatasetToSupabase updates pre-existing matches that have external_source_key and null slug without PK/UNIQUE collision", async () => {
    const sampleMatch = SEED_DATASET.matches.find((m) => m.externalSourceKey)!;
    const preExistingMatchUuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const preExistingSeasonUuid = "11111111-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    const { store, client } = createPgFaithfulSupabaseMock({
      seasons: [
        {
          id: preExistingSeasonUuid,
          year: 2025,
          name: "Temporada 2025",
          status: "finished",
          cup_cutoff_date: "2025-07-01",
        },
      ],
      matches: [
        {
          id: preExistingMatchUuid,
          slug: null,
          season_id: preExistingSeasonUuid,
          match_number: sampleMatch.matchNumber,
          match_date: sampleMatch.matchDate,
          match_type: sampleMatch.matchType,
          modality: sampleMatch.modality,
          team_a_score: sampleMatch.teamAScore,
          team_b_score: sampleMatch.teamBScore,
          result_outcome: null,
          counts_for_league: sampleMatch.countsForLeague,
          counts_for_stats: sampleMatch.countsForStats,
          voting_status: "closed",
          external_source_key: sampleMatch.externalSourceKey,
          notes: sampleMatch.notes ?? null,
        },
      ],
    });

    await syncDatasetToSupabase(client, SEED_DATASET);
    expect(store.get("matches")?.length).toBe(SEED_DATASET.matches.length);
  });

  it("Probe 2 (B2): case-variant raw_name aliases ('Pipo' vs 'pipo') do not collide on player_aliases primary key", async () => {
    const datasetWithCaseVariantAlias: TournamentDataset = {
      ...SEED_DATASET,
      aliases: [
        ...SEED_DATASET.aliases,
        {
          id: "alias-case-variant",
          playerId: "pipo",
          rawName: "pipo",
        },
      ],
    };

    const { store, client } = createPgFaithfulSupabaseMock();
    await syncDatasetToSupabase(client, datasetWithCaseVariantAlias);
    expect(store.get("player_aliases")?.length).toBe(
      datasetWithCaseVariantAlias.aliases.length
    );
  });

  it("Probe 3 (B3): DB roundtrip followed by Excel applyImportDiff preserves star counts and re-syncs cleanly without duplicate conflict rows", async () => {
    const reconstructed = mapDatabaseRowsToDataset(
      mapDatasetToDatabaseRows(SEED_DATASET)
    );
    const merged = applyImportDiff(reconstructed, SEED_DATASET, {
      overwriteExisting: false,
    });

    const expectedStandings = computeStandings({
      players: SEED_DATASET.players,
      matches: SEED_DATASET.matches,
      titles: SEED_DATASET.titles,
    });
    const actualStandings = computeStandings({
      players: merged.players,
      matches: merged.matches,
      titles: merged.titles,
    });
    expect(actualStandings).toEqual(expectedStandings);
    expect(merged.titles.length).toBe(SEED_DATASET.titles.length);
    expect(merged.aliases.length).toBe(SEED_DATASET.aliases.length);

    const { client } = createPgFaithfulSupabaseMock();
    await syncDatasetToSupabase(client, merged);
  });

  it("Probe 4 (B4): mapDatabaseRowsToDataset sorts matches and calendarEvents descending by date regardless of SQL heap order", () => {
    const rows = mapDatasetToDatabaseRows(SEED_DATASET);
    const shuffledRows = {
      ...rows,
      matches: [...rows.matches].reverse(),
      calendar_events: [...rows.calendar_events].reverse(),
    };

    const reconstructed = mapDatabaseRowsToDataset(shuffledRows);
    const matchDates = reconstructed.matches.map((m) => m.matchDate);
    const sortedMatchDates = [...matchDates].sort((a, b) => b.localeCompare(a));
    expect(matchDates).toEqual(sortedMatchDates);

    const eventDates = reconstructed.calendarEvents.map((e) => e.eventDate);
    const sortedEventDates = [...eventDates].sort((a, b) => b.localeCompare(a));
    expect(eventDates).toEqual(sortedEventDates);
  });

  it("defines 0003 migration for player_link_requests, RLS guards, case-insensitive email uniqueness, and admin auth-link RPC", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/0003_player_link_requests.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.player_link_requests/i);
    expect(sql).toMatch(/status IN \('pending', 'approved', 'rejected'\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*ON public\.player_link_requests \(user_id\)[\s\S]*WHERE status = 'pending'/i);
    expect(sql).toMatch(/ALTER TABLE public\.player_link_requests ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/p\.user_id IS NULL[\s\S]*p\.role <> 'admin'/i);
    expect(sql).toMatch(/public\.is_admin\(\)/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*ON public\.players \(lower\(email\)\)[\s\S]*WHERE email IS NOT NULL/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_list_player_auth_links\(\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_auth_user\(\)/i);
  });
});
