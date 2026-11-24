import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/config";
import type {
  Announcement,
  CalendarEvent,
  Match,
  PlayerAlias,
  PlayerTitle,
  Season,
} from "@/lib/types/domain";
import { mapDatabaseRowsToDataset } from "@/server/db/mappers";
import type {
  DbAnnouncementRow,
  DbCalendarEventRow,
  DbCupEditionRow,
  DbCupTieRow,
  DbMatchPlayerRow,
  DbMatchRow,
  DbPlayerAliasRow,
  DbPlayerRow,
  DbPlayerTitleRow,
  DbSeasonRow,
} from "@/server/db/types";
import type { PublicTournamentRepository } from "./ports";
import { toPublicPlayer, toPublicTournamentData } from "./projections";
import type {
  PublicCupData,
  PublicPlayer,
  PublicTournamentData,
} from "./types";

const PAGE_SIZE = 1000;

/**
 * Explicit public column lists — NEVER select `email` or `user_id` from `public.players`.
 */
export const PUBLIC_PLAYER_COLUMNS =
  "id, slug, display_name, nickname, avatar_url, role, favorite_club_id, political_orientation, is_active" as const;

const SEASON_COLUMNS = "id, year, name, status, cup_cutoff_date";
const ALIAS_COLUMNS = "id, player_id, raw_name";
const TITLE_COLUMNS = "id, player_id, season_id, title_type, awarded_at";
const MATCH_COLUMNS =
  "id, slug, season_id, match_number, match_date, match_type, modality, team_a_score, team_b_score, result_outcome, counts_for_league, counts_for_stats, voting_status, external_source_key, notes";
const MATCH_PLAYER_COLUMNS =
  "id, match_id, player_id, team, is_cup_captain, goals, assists, admin_rating, is_mvp";
const CALENDAR_COLUMNS =
  "id, external_key, season_id, title, description, event_date, event_type, match_id";
const ANNOUNCEMENT_COLUMNS =
  "id, external_key, title, body, is_pinned, created_by, created_at";
const CUP_EDITION_COLUMNS = "id, season_id, name, cutoff_snapshot_json";
const CUP_TIE_COLUMNS =
  "id, cup_edition_id, round, slot_order, player_a_id, player_b_id, seed_a, seed_b, leg1_match_id, leg2_match_id, override_score_a, override_score_b, winner_player_id, notes";

export function createPublicSupabaseClient(): SupabaseClient {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are not configured."
    );
  }
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchAllRows<T>(
  client: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Supabase query failed on "${table}": ${error.message}`);
    }

    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
}

/**
 * Production/development repository backed by Supabase PostgreSQL.
 * Strictly reads public tournament tables and never queries `fund_*` or `players.email`.
 */
export class SupabaseTournamentRepository
  implements PublicTournamentRepository
{
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? createPublicSupabaseClient();
  }

  async getPublicDataset(): Promise<PublicTournamentData> {
    const [
      seasons,
      players,
      player_aliases,
      player_titles,
      matches,
      match_players,
      calendar_events,
      announcements,
      cup_editions,
      cup_ties,
    ] = await Promise.all([
      fetchAllRows<DbSeasonRow>(this.client, "seasons", SEASON_COLUMNS),
      fetchAllRows<DbPlayerRow>(this.client, "players", PUBLIC_PLAYER_COLUMNS),
      fetchAllRows<DbPlayerAliasRow>(
        this.client,
        "player_aliases",
        ALIAS_COLUMNS
      ),
      fetchAllRows<DbPlayerTitleRow>(
        this.client,
        "player_titles",
        TITLE_COLUMNS
      ),
      fetchAllRows<DbMatchRow>(this.client, "matches", MATCH_COLUMNS),
      fetchAllRows<DbMatchPlayerRow>(
        this.client,
        "match_players",
        MATCH_PLAYER_COLUMNS
      ),
      fetchAllRows<DbCalendarEventRow>(
        this.client,
        "calendar_events",
        CALENDAR_COLUMNS
      ),
      fetchAllRows<DbAnnouncementRow>(
        this.client,
        "announcements",
        ANNOUNCEMENT_COLUMNS
      ),
      fetchAllRows<DbCupEditionRow>(
        this.client,
        "cup_editions",
        CUP_EDITION_COLUMNS
      ),
      fetchAllRows<DbCupTieRow>(this.client, "cup_ties", CUP_TIE_COLUMNS),
    ]);

    const dataset = mapDatabaseRowsToDataset({
      seasons,
      players,
      player_aliases,
      player_titles,
      matches,
      match_players,
      calendar_events,
      announcements,
      cup_editions,
      cup_ties,
    });

    return toPublicTournamentData(dataset);
  }

  async getSeasons(): Promise<Season[]> {
    const seasons = await fetchAllRows<DbSeasonRow>(
      this.client,
      "seasons",
      SEASON_COLUMNS
    );
    return mapDatabaseRowsToDataset({ seasons }).seasons;
  }

  async getPlayers(): Promise<PublicPlayer[]> {
    const players = await fetchAllRows<DbPlayerRow>(
      this.client,
      "players",
      PUBLIC_PLAYER_COLUMNS
    );
    return mapDatabaseRowsToDataset({ players }).players.map(toPublicPlayer);
  }

  async getPlayerById(playerId: string): Promise<PublicPlayer | null> {
    const players = await this.getPlayers();
    return players.find((player) => player.id === playerId) ?? null;
  }

  async getAliases(): Promise<PlayerAlias[]> {
    const [players, player_aliases] = await Promise.all([
      fetchAllRows<DbPlayerRow>(this.client, "players", PUBLIC_PLAYER_COLUMNS),
      fetchAllRows<DbPlayerAliasRow>(
        this.client,
        "player_aliases",
        ALIAS_COLUMNS
      ),
    ]);
    return mapDatabaseRowsToDataset({ players, player_aliases }).aliases;
  }

  async getTitles(seasonId?: string): Promise<PlayerTitle[]> {
    const [seasons, players, player_titles] = await Promise.all([
      fetchAllRows<DbSeasonRow>(this.client, "seasons", SEASON_COLUMNS),
      fetchAllRows<DbPlayerRow>(this.client, "players", PUBLIC_PLAYER_COLUMNS),
      fetchAllRows<DbPlayerTitleRow>(
        this.client,
        "player_titles",
        TITLE_COLUMNS
      ),
    ]);
    const titles = mapDatabaseRowsToDataset({
      seasons,
      players,
      player_titles,
    }).titles;
    return seasonId
      ? titles.filter((title) => title.seasonId === seasonId)
      : titles;
  }

  async getMatches(seasonId?: string): Promise<Match[]> {
    const [seasons, players, matches, match_players] = await Promise.all([
      fetchAllRows<DbSeasonRow>(this.client, "seasons", SEASON_COLUMNS),
      fetchAllRows<DbPlayerRow>(this.client, "players", PUBLIC_PLAYER_COLUMNS),
      fetchAllRows<DbMatchRow>(this.client, "matches", MATCH_COLUMNS),
      fetchAllRows<DbMatchPlayerRow>(
        this.client,
        "match_players",
        MATCH_PLAYER_COLUMNS
      ),
    ]);
    const mapped = mapDatabaseRowsToDataset({
      seasons,
      players,
      matches,
      match_players,
    }).matches;
    return seasonId
      ? mapped.filter((match) => match.seasonId === seasonId)
      : mapped;
  }

  async getMatchById(matchId: string): Promise<Match | null> {
    const matches = await this.getMatches();
    return matches.find((match) => match.id === matchId) ?? null;
  }

  async getCalendarEvents(seasonId?: string): Promise<CalendarEvent[]> {
    const [seasons, matches, calendar_events] = await Promise.all([
      fetchAllRows<DbSeasonRow>(this.client, "seasons", SEASON_COLUMNS),
      fetchAllRows<DbMatchRow>(this.client, "matches", MATCH_COLUMNS),
      fetchAllRows<DbCalendarEventRow>(
        this.client,
        "calendar_events",
        CALENDAR_COLUMNS
      ),
    ]);
    const mapped = mapDatabaseRowsToDataset({
      seasons,
      matches,
      calendar_events,
    }).calendarEvents;
    return seasonId
      ? mapped.filter((event) => event.seasonId === seasonId)
      : mapped;
  }

  async getAnnouncements(): Promise<Announcement[]> {
    const [players, announcements] = await Promise.all([
      fetchAllRows<DbPlayerRow>(this.client, "players", PUBLIC_PLAYER_COLUMNS),
      fetchAllRows<DbAnnouncementRow>(
        this.client,
        "announcements",
        ANNOUNCEMENT_COLUMNS
      ),
    ]);
    return mapDatabaseRowsToDataset({ players, announcements }).announcements;
  }

  async getCupData(seasonId?: string): Promise<PublicCupData> {
    const [seasons, players, matches, cup_editions, cup_ties] =
      await Promise.all([
        fetchAllRows<DbSeasonRow>(this.client, "seasons", SEASON_COLUMNS),
        fetchAllRows<DbPlayerRow>(
          this.client,
          "players",
          PUBLIC_PLAYER_COLUMNS
        ),
        fetchAllRows<DbMatchRow>(this.client, "matches", MATCH_COLUMNS),
        fetchAllRows<DbCupEditionRow>(
          this.client,
          "cup_editions",
          CUP_EDITION_COLUMNS
        ),
        fetchAllRows<DbCupTieRow>(this.client, "cup_ties", CUP_TIE_COLUMNS),
      ]);

    const mapped = mapDatabaseRowsToDataset({
      seasons,
      players,
      matches,
      cup_editions,
      cup_ties,
    });

    if (!seasonId) {
      return {
        editions: mapped.cupEditions,
        ties: mapped.cupTies,
      };
    }

    const editions = mapped.cupEditions.filter(
      (edition) => edition.seasonId === seasonId
    );
    const editionIds = new Set(editions.map((edition) => edition.id));
    const ties = mapped.cupTies.filter((tie) =>
      editionIds.has(tie.cupEditionId)
    );
    return { editions, ties };
  }
}
