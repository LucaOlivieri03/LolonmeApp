import "server-only";
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
 * Deduplicates outgoing rows by their `onConflict` composite key (last-write-wins)
 * so PostgreSQL never raises `21000: ON CONFLICT DO UPDATE command cannot affect row a second time`.
 */
function dedupeRowsByConflict(
  rows: Record<string, unknown>[],
  onConflict: string
): Record<string, unknown>[] {
  const cols = onConflict.split(",").map((c) => c.trim());
  const byKey = new Map<string, Record<string, unknown>>();
  const nullKeyRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const hasNull = cols.some(
      (col) => row[col] === null || row[col] === undefined
    );
    if (hasNull) {
      nullKeyRows.push(row);
      continue;
    }
    const compositeKey = cols.map((col) => JSON.stringify(row[col])).join("|");
    byKey.set(compositeKey, row);
  }

  return [...byKey.values(), ...nullKeyRows];
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
      const deduped = dedupeRowsByConflict(rows, onConflict);
      if (deduped.length === 0) return;
      for (let i = 0; i < deduped.length; i += UPSERT_BATCH_SIZE) {
        const chunk = deduped.slice(i, i + UPSERT_BATCH_SIZE);
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
      "id,slug,user_id,email,role,nickname,avatar_url,favorite_club_id,political_orientation,is_active"
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
  const existingMatchById = new Map<string, Record<string, unknown>>();
  const reservedSlugsByOtherId = new Map<string, string>();
  for (const row of existingMatches) {
    if (typeof row.id === "string") {
      existingMatchById.set(row.id, row);
      if (typeof row.external_source_key === "string") {
        matchUuidBySourceKey.set(row.external_source_key, row.id);
      }
      if (typeof row.slug === "string" && row.slug !== "") {
        matchUuidBySlug.set(row.slug, row.id);
        reservedSlugsByOtherId.set(row.slug, row.id);
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

  const safePlayers = dedupeRowsByConflict(
    rows.players.map((p) => {
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
        political_orientation:
          p.political_orientation ?? prev.political_orientation ?? null,
        is_active:
          typeof prev.is_active === "boolean" ? prev.is_active : p.is_active,
      } as Record<string, unknown>;
    }),
    "slug"
  );

  // Preserve pre-existing match rows matched by external_source_key (even when slug was NULL)
  const safeMatches = dedupeRowsByConflict(
    rows.matches.map((m) => {
      const prev = existingMatchById.get(m.id);
      const prevSlug =
        prev && typeof prev.slug === "string" && prev.slug !== ""
          ? prev.slug
          : null;
      const desiredSlug = prevSlug ?? m.slug ?? m.id;
      const slugOwner = reservedSlugsByOtherId.get(desiredSlug);
      const finalSlug =
        slugOwner && slugOwner !== m.id
          ? `${desiredSlug}-${m.id.slice(0, 8)}`
          : desiredSlug;

      return {
        ...m,
        slug: finalSlug,
      } as unknown as Record<string, unknown>;
    }),
    "id"
  );

  const safeSeasons = dedupeRowsByConflict(
    rows.seasons as unknown as Record<string, unknown>[],
    "year"
  );
  const safeAliases = dedupeRowsByConflict(
    rows.player_aliases as unknown as Record<string, unknown>[],
    "raw_name"
  );
  const safeTitles = dedupeRowsByConflict(
    rows.player_titles as unknown as Record<string, unknown>[],
    "player_id,season_id,title_type"
  );
  const safeMatchPlayers = dedupeRowsByConflict(
    rows.match_players as unknown as Record<string, unknown>[],
    "match_id,player_id"
  );
  const safeCalendarEvents = dedupeRowsByConflict(
    rows.calendar_events as unknown as Record<string, unknown>[],
    "external_key"
  );
  const safeAnnouncements = dedupeRowsByConflict(
    rows.announcements as unknown as Record<string, unknown>[],
    "external_key"
  );
  const safeCupEditions = dedupeRowsByConflict(
    rows.cup_editions as unknown as Record<string, unknown>[],
    "season_id"
  );
  const safeCupTies = dedupeRowsByConflict(
    rows.cup_ties as unknown as Record<string, unknown>[],
    "cup_edition_id,round,slot_order"
  );
  const safeFundMonths = dedupeRowsByConflict(
    rows.fund_months as unknown as Record<string, unknown>[],
    "season_id,month_number"
  );
  const safeFundPayments = dedupeRowsByConflict(
    rows.fund_payments as unknown as Record<string, unknown>[],
    "fund_month_id,player_id"
  );
  const safeFundTransactions = dedupeRowsByConflict(
    rows.fund_transactions as unknown as Record<string, unknown>[],
    "external_key"
  );

  // Upsert in strict foreign-key topological order
  await client.upsertRows("seasons", safeSeasons, "year");
  await client.upsertRows("players", safePlayers, "slug");
  await client.upsertRows("player_aliases", safeAliases, "raw_name");
  await client.upsertRows(
    "player_titles",
    safeTitles,
    "player_id,season_id,title_type"
  );
  await client.upsertRows("matches", safeMatches, "id");
  await client.upsertRows("match_players", safeMatchPlayers, "match_id,player_id");
  await client.upsertRows("calendar_events", safeCalendarEvents, "external_key");
  await client.upsertRows("announcements", safeAnnouncements, "external_key");
  await client.upsertRows("cup_editions", safeCupEditions, "season_id");
  await client.upsertRows(
    "cup_ties",
    safeCupTies,
    "cup_edition_id,round,slot_order"
  );
  await client.upsertRows(
    "fund_months",
    safeFundMonths,
    "season_id,month_number"
  );
  await client.upsertRows(
    "fund_payments",
    safeFundPayments,
    "fund_month_id,player_id"
  );
  await client.upsertRows(
    "fund_transactions",
    safeFundTransactions,
    "external_key"
  );

  return {
    seasons: safeSeasons.length,
    players: safePlayers.length,
    player_aliases: safeAliases.length,
    player_titles: safeTitles.length,
    matches: safeMatches.length,
    match_players: safeMatchPlayers.length,
    calendar_events: safeCalendarEvents.length,
    announcements: safeAnnouncements.length,
    cup_editions: safeCupEditions.length,
    cup_ties: safeCupTies.length,
    fund_months: safeFundMonths.length,
    fund_payments: safeFundPayments.length,
    fund_transactions: safeFundTransactions.length,
  };
}
