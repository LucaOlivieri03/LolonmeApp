import type { SupabaseClient } from "@supabase/supabase-js";
import type { TournamentDataset } from "@/lib/types/domain";
import { mapDatasetToDatabaseRows, type ExistingUuidLookups } from "./mappers";

const UPSERT_BATCH_SIZE = 200;

export interface SeedTableClient {
  selectAll(
    table: string,
    columns: string
  ): Promise<Record<string, unknown>[]>;
  upsertRows(
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string
  ): Promise<void>;
}

export interface SeedSyncSummary {
  seasons: number;
  players: number;
  player_aliases: number;
  player_titles: number;
  matches: number;
  match_players: number;
  calendar_events: number;
  announcements: number;
  cup_editions: number;
  cup_ties: number;
  fund_months: number;
  fund_payments: number;
  fund_transactions: number;
}

/**
 * Wraps a Supabase service-role client into `SeedTableClient` with batched upserts.
 */
export function createSupabaseSeedClient(
  supabase: SupabaseClient
): SeedTableClient {
  return {
    async selectAll(table, columns) {
      const { data, error } = await supabase.from(table).select(columns);
      if (error) {
        throw new Error(`Failed reading ${table}: ${error.message}`);
      }
      return (data ?? []) as unknown as Record<string, unknown>[];
    },
    async upsertRows(table, rows, onConflict) {
      if (rows.length === 0) return;
      for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
        const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabase
          .from(table)
          .upsert(chunk, { onConflict });
        if (error) {
          throw new Error(
            `Failed upserting ${table} (batch ${i}..${i + chunk.length}): ${error.message}`
          );
        }
      }
    },
  };
}

/**
 * Idempotently synchronizes a `TournamentDataset` into PostgreSQL via natural conflict keys,
 * preserving pre-existing entity UUIDs and linked Supabase Auth player attributes.
 */
export async function syncDatasetToSupabase(
  client: SeedTableClient,
  dataset: TournamentDataset
): Promise<SeedSyncSummary> {
  // 1. Read existing canonical entities so existing UUIDs & Auth links are never orphaned or overwritten
  const [
    existingSeasons,
    existingPlayers,
    existingMatches,
    existingCupEditions,
    existingFundMonths,
  ] = await Promise.all([
    client.selectAll("seasons", "id,year"),
    client.selectAll(
      "players",
      "id,slug,user_id,email,role,nickname,avatar_url,favorite_club_id,is_active"
    ),
    client.selectAll("matches", "id,slug,external_source_key"),
    client.selectAll("cup_editions", "id,season_id"),
    client.selectAll("fund_months", "id,season_id,month_number"),
  ]);

  const seasonUuidByYear = new Map<number, string>();
  for (const row of existingSeasons) {
    if (typeof row.year === "number" && typeof row.id === "string") {
      seasonUuidByYear.set(row.year, row.id);
    }
  }

  const playerUuidBySlug = new Map<string, string>();
  const existingPlayerBySlug = new Map<string, Record<string, unknown>>();
  for (const row of existingPlayers) {
    if (typeof row.slug === "string" && typeof row.id === "string") {
      playerUuidBySlug.set(row.slug, row.id);
      existingPlayerBySlug.set(row.slug, row);
    }
  }

  const matchUuidBySourceKey = new Map<string, string>();
  const matchUuidBySlug = new Map<string, string>();
  for (const row of existingMatches) {
    if (typeof row.id === "string") {
      if (typeof row.external_source_key === "string") {
        matchUuidBySourceKey.set(row.external_source_key, row.id);
      }
      if (typeof row.slug === "string") {
        matchUuidBySlug.set(row.slug, row.id);
      }
    }
  }

  const cupEditionUuidBySeasonUuid = new Map<string, string>();
  for (const row of existingCupEditions) {
    if (typeof row.season_id === "string" && typeof row.id === "string") {
      cupEditionUuidBySeasonUuid.set(row.season_id, row.id);
    }
  }

  const fundMonthUuidBySeasonAndMonth = new Map<string, string>();
  for (const row of existingFundMonths) {
    if (
      typeof row.season_id === "string" &&
      typeof row.month_number === "number" &&
      typeof row.id === "string"
    ) {
      fundMonthUuidBySeasonAndMonth.set(
        `${row.season_id}:${row.month_number}`,
        row.id
      );
    }
  }

  const lookups: ExistingUuidLookups = {
    seasonUuidByYear,
    playerUuidBySlug,
    matchUuidBySourceKey,
    matchUuidBySlug,
    cupEditionUuidBySeasonUuid,
    fundMonthUuidBySeasonAndMonth,
  };

  const rows = mapDatasetToDatabaseRows(dataset, lookups);

  // Merge existing Auth/profile attributes onto player rows so re-seeding never clobbers live accounts
  const safePlayers = rows.players.map((p) => {
    const prev = existingPlayerBySlug.get(p.slug);
    if (!prev) return p as unknown as Record<string, unknown>;

    return {
      ...p,
      user_id: p.user_id ?? prev.user_id ?? null,
      email: p.email ?? prev.email ?? null,
      role:
        prev.role === "admin" || prev.role === "authorized"
          ? prev.role
          : p.role,
      nickname: p.nickname ?? prev.nickname ?? null,
      avatar_url: p.avatar_url ?? prev.avatar_url ?? null,
      favorite_club_id: p.favorite_club_id ?? prev.favorite_club_id ?? null,
      is_active:
        typeof prev.is_active === "boolean" ? prev.is_active : p.is_active,
    } as Record<string, unknown>;
  });

  // 2. Upsert in strict foreign-key topological order
  await client.upsertRows(
    "seasons",
    rows.seasons as unknown as Record<string, unknown>[],
    "year"
  );
  await client.upsertRows("players", safePlayers, "slug");
  await client.upsertRows(
    "player_aliases",
    rows.player_aliases as unknown as Record<string, unknown>[],
    "raw_name"
  );
  await client.upsertRows(
    "player_titles",
    rows.player_titles as unknown as Record<string, unknown>[],
    "player_id,season_id,title_type"
  );
  await client.upsertRows(
    "matches",
    rows.matches as unknown as Record<string, unknown>[],
    "slug"
  );
  await client.upsertRows(
    "match_players",
    rows.match_players as unknown as Record<string, unknown>[],
    "match_id,player_id"
  );
  await client.upsertRows(
    "calendar_events",
    rows.calendar_events as unknown as Record<string, unknown>[],
    "external_key"
  );
  await client.upsertRows(
    "announcements",
    rows.announcements as unknown as Record<string, unknown>[],
    "external_key"
  );
  await client.upsertRows(
    "cup_editions",
    rows.cup_editions as unknown as Record<string, unknown>[],
    "season_id"
  );
  await client.upsertRows(
    "cup_ties",
    rows.cup_ties as unknown as Record<string, unknown>[],
    "cup_edition_id,round,slot_order"
  );
  await client.upsertRows(
    "fund_months",
    rows.fund_months as unknown as Record<string, unknown>[],
    "season_id,month_number"
  );
  await client.upsertRows(
    "fund_payments",
    rows.fund_payments as unknown as Record<string, unknown>[],
    "fund_month_id,player_id"
  );
  await client.upsertRows(
    "fund_transactions",
    rows.fund_transactions as unknown as Record<string, unknown>[],
    "external_key"
  );

  return {
    seasons: rows.seasons.length,
    players: safePlayers.length,
    player_aliases: rows.player_aliases.length,
    player_titles: rows.player_titles.length,
    matches: rows.matches.length,
    match_players: rows.match_players.length,
    calendar_events: rows.calendar_events.length,
    announcements: rows.announcements.length,
    cup_editions: rows.cup_editions.length,
    cup_ties: rows.cup_ties.length,
    fund_months: rows.fund_months.length,
    fund_payments: rows.fund_payments.length,
    fund_transactions: rows.fund_transactions.length,
  };
}
