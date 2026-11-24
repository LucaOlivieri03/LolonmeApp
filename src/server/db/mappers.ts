import { createHash } from "crypto";
import type {
  Announcement,
  CalendarEvent,
  CupEdition,
  CupRound,
  CupTie,
  FundMonth,
  FundPayment,
  FundTransaction,
  Match,
  MatchPlayer,
  Player,
  PlayerAlias,
  PlayerTitle,
  Season,
  TournamentDataset,
} from "@/lib/types/domain";
import type { DatabaseDatasetRows, DbNumeric } from "./types";

/**
 * Fixed RFC 4122 namespace UUID for deterministic LOLONMEBOL entity identifiers.
 */
const LOLONMEBOL_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CUP_ROUND_CODE: Record<CupRound, string> = {
  preliminary: "prelim",
  quarterfinal: "qf",
  semifinal: "sf",
  final: "final",
  lolonmebol: "lolonmebol",
};

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Buffer.from(bytes).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Generates a deterministic RFC 4122 UUIDv5 from a canonical entity key.
 */
export function deterministicUuid(key: string): string {
  const nsBytes = uuidToBytes(LOLONMEBOL_UUID_NAMESPACE);
  const nameBytes = Buffer.from(key, "utf8");
  const digest = createHash("sha1")
    .update(Buffer.concat([nsBytes, nameBytes]))
    .digest();

  const bytes = Uint8Array.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // Version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  return bytesToUuid(bytes);
}

function parseNullableNumber(val: DbNumeric | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : Number(val);
  return Number.isFinite(num) ? num : null;
}

function parseRequiredNumber(val: DbNumeric): number {
  const num = typeof val === "number" ? val : Number(val);
  return Number.isFinite(num) ? num : 0;
}

export interface ExistingUuidLookups {
  seasonUuidByYear?: ReadonlyMap<number, string>;
  playerUuidBySlug?: ReadonlyMap<string, string>;
  matchUuidBySourceKey?: ReadonlyMap<string, string>;
  matchUuidBySlug?: ReadonlyMap<string, string>;
  cupEditionUuidBySeasonUuid?: ReadonlyMap<string, string>;
  fundMonthUuidBySeasonAndMonth?: ReadonlyMap<string, string>;
}

/**
 * Maps a domain `TournamentDataset` into normalized PostgreSQL table rows
 * using existing database UUIDs when provided or deterministic UUIDv5 keys.
 */
export function mapDatasetToDatabaseRows(
  dataset: TournamentDataset,
  existing?: ExistingUuidLookups
): DatabaseDatasetRows {
  const seasonUuidByDomainId = new Map<string, string>();
  const seasonYearByDomainId = new Map<string, number>();

  const seasons = dataset.seasons.map((season) => {
    const id =
      existing?.seasonUuidByYear?.get(season.year) ??
      (UUID_REGEX.test(season.id)
        ? season.id
        : deterministicUuid(`season:${season.year}`));
    seasonUuidByDomainId.set(season.id, id);
    seasonYearByDomainId.set(season.id, season.year);
    return {
      id,
      year: season.year,
      name: season.name,
      status: season.status,
      cup_cutoff_date: season.cupCutoffDate ?? null,
    };
  });

  const playerUuidByDomainId = new Map<string, string>();
  const players = dataset.players.map((player) => {
    const slug = player.id;
    const id =
      existing?.playerUuidBySlug?.get(slug) ??
      (UUID_REGEX.test(player.id)
        ? player.id
        : deterministicUuid(`player:${slug}`));
    playerUuidByDomainId.set(player.id, id);
    return {
      id,
      slug,
      ...(player.userId !== undefined ? { user_id: player.userId } : {}),
      ...(player.email !== undefined ? { email: player.email } : {}),
      display_name: player.displayName,
      nickname: player.nickname ?? null,
      avatar_url: player.avatarUrl ?? null,
      role: player.role,
      favorite_club_id: player.favoriteClubId ?? null,
      is_active: player.isActive,
    };
  });

  const resolvePlayerUuid = (domainPlayerId: string): string =>
    playerUuidByDomainId.get(domainPlayerId) ??
    existing?.playerUuidBySlug?.get(domainPlayerId) ??
    (UUID_REGEX.test(domainPlayerId)
      ? domainPlayerId
      : deterministicUuid(`player:${domainPlayerId}`));

  const resolveSeasonUuid = (domainSeasonId: string): string =>
    seasonUuidByDomainId.get(domainSeasonId) ??
    (UUID_REGEX.test(domainSeasonId)
      ? domainSeasonId
      : deterministicUuid(`season:${domainSeasonId}`));

  const player_aliases = dataset.aliases.map((alias) => ({
    id: UUID_REGEX.test(alias.id)
      ? alias.id
      : deterministicUuid(`alias:${alias.rawName.toLowerCase()}`),
    player_id: resolvePlayerUuid(alias.playerId),
    raw_name: alias.rawName,
  }));

  const player_titles = dataset.titles.map((title) => {
    const playerId = resolvePlayerUuid(title.playerId);
    const seasonId = resolveSeasonUuid(title.seasonId);
    return {
      id: UUID_REGEX.test(title.id)
        ? title.id
        : deterministicUuid(`title:${seasonId}:${playerId}:${title.titleType}`),
      player_id: playerId,
      season_id: seasonId,
      title_type: title.titleType,
      awarded_at: title.awardedAt,
    };
  });

  const matchUuidByDomainId = new Map<string, string>();
  const matches = dataset.matches.map((match) => {
    const sourceKey = match.externalSourceKey ?? null;
    const slug = match.id;
    const id =
      (sourceKey ? existing?.matchUuidBySourceKey?.get(sourceKey) : undefined) ??
      existing?.matchUuidBySlug?.get(slug) ??
      (UUID_REGEX.test(match.id)
        ? match.id
        : deterministicUuid(`match:${sourceKey ?? slug}`));
    matchUuidByDomainId.set(match.id, id);

    return {
      id,
      slug,
      season_id: resolveSeasonUuid(match.seasonId),
      match_number: match.matchNumber,
      match_date: match.matchDate,
      match_type: match.matchType,
      modality: match.modality,
      team_a_score: match.teamAScore,
      team_b_score: match.teamBScore,
      result_outcome: match.resultOutcome ?? null,
      counts_for_league: match.countsForLeague,
      counts_for_stats: match.countsForStats,
      voting_status: match.votingStatus,
      external_source_key: sourceKey,
      notes: match.notes ?? null,
    };
  });

  const resolveMatchUuid = (domainMatchId: string | null | undefined): string | null => {
    if (!domainMatchId) return null;
    return (
      matchUuidByDomainId.get(domainMatchId) ??
      existing?.matchUuidBySlug?.get(domainMatchId) ??
      (UUID_REGEX.test(domainMatchId)
        ? domainMatchId
        : deterministicUuid(`match:${domainMatchId}`))
    );
  };

  const match_players = dataset.matches.flatMap((match) => {
    const matchId = matchUuidByDomainId.get(match.id)!;
    return match.players.map((mp) => {
      const playerId = resolvePlayerUuid(mp.playerId);
      return {
        id: UUID_REGEX.test(mp.id)
          ? mp.id
          : deterministicUuid(`match_player:${matchId}:${playerId}`),
        match_id: matchId,
        player_id: playerId,
        team: mp.team,
        is_cup_captain: mp.isCupCaptain,
        goals: mp.goals,
        assists: mp.assists,
        admin_rating: mp.adminRating,
        is_mvp: mp.isMvp,
      };
    });
  });

  const calendar_events = dataset.calendarEvents.map((ev) => ({
    id: UUID_REGEX.test(ev.id) ? ev.id : deterministicUuid(`calendar:${ev.id}`),
    external_key: ev.id,
    season_id: resolveSeasonUuid(ev.seasonId),
    title: ev.title,
    description: ev.description ?? null,
    event_date: ev.eventDate,
    event_type: ev.eventType,
    match_id: resolveMatchUuid(ev.matchId),
  }));

  const announcements = dataset.announcements.map((ann) => ({
    id: UUID_REGEX.test(ann.id) ? ann.id : deterministicUuid(`announcement:${ann.id}`),
    external_key: ann.id,
    title: ann.title,
    body: ann.body,
    is_pinned: ann.isPinned,
    created_by: ann.createdBy ? resolvePlayerUuid(ann.createdBy) : null,
    created_at: ann.createdAt,
  }));

  const cupEditionUuidByDomainId = new Map<string, string>();
  const cup_editions = dataset.cupEditions.map((ed) => {
    const seasonUuid = resolveSeasonUuid(ed.seasonId);
    const id =
      existing?.cupEditionUuidBySeasonUuid?.get(seasonUuid) ??
      (UUID_REGEX.test(ed.id)
        ? ed.id
        : deterministicUuid(`cup_edition:${seasonUuid}`));
    cupEditionUuidByDomainId.set(ed.id, id);

    return {
      id,
      season_id: seasonUuid,
      name: ed.name,
      cutoff_snapshot_json: ed.cutoffSnapshotPlayerIds.map(resolvePlayerUuid),
    };
  });

  const cup_ties = dataset.cupTies.map((tie) => {
    const editionUuid =
      cupEditionUuidByDomainId.get(tie.cupEditionId) ??
      (UUID_REGEX.test(tie.cupEditionId)
        ? tie.cupEditionId
        : deterministicUuid(`cup_edition:${tie.cupEditionId}`));
    return {
      id: UUID_REGEX.test(tie.id)
        ? tie.id
        : deterministicUuid(`cup_tie:${editionUuid}:${tie.round}:${tie.slotOrder}`),
      cup_edition_id: editionUuid,
      round: tie.round,
      slot_order: tie.slotOrder,
      player_a_id: tie.playerAId ? resolvePlayerUuid(tie.playerAId) : null,
      player_b_id: tie.playerBId ? resolvePlayerUuid(tie.playerBId) : null,
      seed_a: tie.seedA,
      seed_b: tie.seedB,
      leg1_match_id: resolveMatchUuid(tie.leg1MatchId),
      leg2_match_id: resolveMatchUuid(tie.leg2MatchId),
      override_score_a: tie.overrideScoreA,
      override_score_b: tie.overrideScoreB,
      winner_player_id: tie.winnerPlayerId
        ? resolvePlayerUuid(tie.winnerPlayerId)
        : null,
      notes: tie.notes ?? null,
    };
  });

  const fundMonthUuidByDomainId = new Map<string, string>();
  const fund_months = dataset.fundMonths.map((fm) => {
    const seasonUuid = resolveSeasonUuid(fm.seasonId);
    const compositeKey = `${seasonUuid}:${fm.monthNumber}`;
    const id =
      existing?.fundMonthUuidBySeasonAndMonth?.get(compositeKey) ??
      (UUID_REGEX.test(fm.id)
        ? fm.id
        : deterministicUuid(`fund_month:${compositeKey}`));
    fundMonthUuidByDomainId.set(fm.id, id);

    return {
      id,
      season_id: seasonUuid,
      month_number: fm.monthNumber,
      month_label: fm.monthLabel,
      fee_amount: fm.feeAmount,
    };
  });

  const fund_payments = dataset.fundPayments.map((fp) => {
    const fundMonthId =
      fundMonthUuidByDomainId.get(fp.fundMonthId) ??
      (UUID_REGEX.test(fp.fundMonthId)
        ? fp.fundMonthId
        : deterministicUuid(`fund_month:${fp.fundMonthId}`));
    const playerId = resolvePlayerUuid(fp.playerId);
    return {
      id: UUID_REGEX.test(fp.id)
        ? fp.id
        : deterministicUuid(`fund_payment:${fundMonthId}:${playerId}`),
      fund_month_id: fundMonthId,
      player_id: playerId,
      paid: fp.paid,
      paid_at: fp.paidAt ?? null,
    };
  });

  const fund_transactions = dataset.fundTransactions.map((tx) => ({
    id: UUID_REGEX.test(tx.id) ? tx.id : deterministicUuid(`fund_tx:${tx.id}`),
    external_key: tx.id,
    season_id: resolveSeasonUuid(tx.seasonId),
    tx_type: tx.txType,
    amount: tx.amount,
    description: tx.description,
    tx_date: tx.txDate,
  }));

  return {
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
    fund_months,
    fund_payments,
    fund_transactions,
  };
}

/**
 * Reconstructs a `TournamentDataset` from PostgreSQL table rows,
 * resolving relational UUIDs back to canonical domain identifiers.
 */
export function mapDatabaseRowsToDataset(
  rows: Partial<DatabaseDatasetRows>
): TournamentDataset {
  const seasonDomainIdByUuid = new Map<string, string>();
  const seasonYearByUuid = new Map<string, number>();

  const seasons: Season[] = (rows.seasons ?? [])
    .map((row) => {
      const domainId = `season-${row.year}`;
      seasonDomainIdByUuid.set(row.id, domainId);
      seasonYearByUuid.set(row.id, row.year);
      return {
        id: domainId,
        year: row.year,
        name: row.name,
        status: row.status,
        cupCutoffDate: row.cup_cutoff_date ?? null,
      };
    })
    .sort((a, b) => a.year - b.year);

  const playerDomainIdByUuid = new Map<string, string>();
  const players: Player[] = (rows.players ?? [])
    .map((row) => {
      const domainId = row.slug || row.id;
      playerDomainIdByUuid.set(row.id, domainId);
      return {
        id: domainId,
        ...(row.user_id !== undefined ? { userId: row.user_id } : {}),
        ...(row.email !== undefined ? { email: row.email } : {}),
        displayName: row.display_name,
        ...(row.nickname !== undefined && row.nickname !== null
          ? { nickname: row.nickname }
          : {}),
        ...(row.avatar_url !== undefined && row.avatar_url !== null
          ? { avatarUrl: row.avatar_url }
          : {}),
        role: row.role,
        ...(row.favorite_club_id !== undefined && row.favorite_club_id !== null
          ? { favoriteClubId: row.favorite_club_id }
          : {}),
        isActive: row.is_active,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));

  const resolvePlayerId = (uuidOrSlug: string): string =>
    playerDomainIdByUuid.get(uuidOrSlug) ?? uuidOrSlug;

  const resolveSeasonId = (uuid: string): string =>
    seasonDomainIdByUuid.get(uuid) ?? uuid;

  const aliases: PlayerAlias[] = (rows.player_aliases ?? []).map((row) => ({
    id: row.id,
    playerId: resolvePlayerId(row.player_id),
    rawName: row.raw_name,
  }));

  const titles: PlayerTitle[] = (rows.player_titles ?? []).map((row) => ({
    id: row.id,
    playerId: resolvePlayerId(row.player_id),
    seasonId: resolveSeasonId(row.season_id),
    titleType: row.title_type,
    awardedAt: row.awarded_at,
  }));

  const matchDomainIdByUuid = new Map<string, string>();
  for (const row of rows.matches ?? []) {
    matchDomainIdByUuid.set(row.id, row.slug || row.id);
  }

  const matchPlayersByMatchUuid = new Map<string, MatchPlayer[]>();
  for (const mp of rows.match_players ?? []) {
    const matchDomainId = matchDomainIdByUuid.get(mp.match_id) ?? mp.match_id;
    const playerDomainId = resolvePlayerId(mp.player_id);
    const mappedMp: MatchPlayer = {
      id: `${matchDomainId}-${playerDomainId}`,
      matchId: matchDomainId,
      playerId: playerDomainId,
      team: mp.team,
      isCupCaptain: mp.is_cup_captain,
      goals: mp.goals,
      assists: mp.assists,
      adminRating: parseNullableNumber(mp.admin_rating),
      isMvp: mp.is_mvp,
    };
    const bucket = matchPlayersByMatchUuid.get(mp.match_id);
    if (bucket) {
      bucket.push(mappedMp);
    } else {
      matchPlayersByMatchUuid.set(mp.match_id, [mappedMp]);
    }
  }

  const matches: Match[] = (rows.matches ?? []).map((row) => {
    const domainId = matchDomainIdByUuid.get(row.id) ?? row.id;
    return {
      id: domainId,
      seasonId: resolveSeasonId(row.season_id),
      matchNumber: row.match_number,
      matchDate: row.match_date,
      matchType: row.match_type,
      modality: row.modality,
      teamAScore: row.team_a_score,
      teamBScore: row.team_b_score,
      resultOutcome: row.result_outcome ?? null,
      countsForLeague: row.counts_for_league,
      countsForStats: row.counts_for_stats,
      votingStatus: row.voting_status,
      externalSourceKey: row.external_source_key ?? null,
      notes: row.notes ?? null,
      players: matchPlayersByMatchUuid.get(row.id) ?? [],
    };
  });

  const resolveMatchId = (uuid: string | null): string | null =>
    uuid ? (matchDomainIdByUuid.get(uuid) ?? uuid) : null;

  const calendarEvents: CalendarEvent[] = (rows.calendar_events ?? []).map(
    (row) => ({
      id: row.external_key || row.id,
      seasonId: resolveSeasonId(row.season_id),
      title: row.title,
      ...(row.description !== null ? { description: row.description } : {}),
      eventDate: row.event_date,
      eventType: row.event_type,
      matchId: resolveMatchId(row.match_id),
    })
  );

  const announcements: Announcement[] = (rows.announcements ?? []).map(
    (row) => ({
      id: row.external_key || row.id,
      title: row.title,
      body: row.body,
      isPinned: row.is_pinned,
      ...(row.created_by ? { createdBy: resolvePlayerId(row.created_by) } : {}),
      createdAt: row.created_at,
    })
  );

  const cupEditionDomainIdByUuid = new Map<string, string>();
  const cupEditionYearByUuid = new Map<string, number | undefined>();

  const cupEditions: CupEdition[] = (rows.cup_editions ?? []).map((row) => {
    const year = seasonYearByUuid.get(row.season_id);
    const domainId = year ? `cup-${year}` : row.id;
    cupEditionDomainIdByUuid.set(row.id, domainId);
    cupEditionYearByUuid.set(row.id, year);

    const rawSnapshot = Array.isArray(row.cutoff_snapshot_json)
      ? row.cutoff_snapshot_json
      : [];

    return {
      id: domainId,
      seasonId: resolveSeasonId(row.season_id),
      name: row.name,
      cutoffSnapshotPlayerIds: rawSnapshot.map(resolvePlayerId),
    };
  });

  const cupTies: CupTie[] = (rows.cup_ties ?? []).map((row) => {
    const editionDomainId =
      cupEditionDomainIdByUuid.get(row.cup_edition_id) ?? row.cup_edition_id;
    const year = cupEditionYearByUuid.get(row.cup_edition_id);
    const roundCode = CUP_ROUND_CODE[row.round] ?? row.round;
    const domainId = year
      ? `cup-${year}-${roundCode}-${row.slot_order}`
      : row.id;

    return {
      id: domainId,
      cupEditionId: editionDomainId,
      round: row.round,
      slotOrder: row.slot_order,
      playerAId: row.player_a_id ? resolvePlayerId(row.player_a_id) : null,
      playerBId: row.player_b_id ? resolvePlayerId(row.player_b_id) : null,
      seedA: row.seed_a,
      seedB: row.seed_b,
      leg1MatchId: resolveMatchId(row.leg1_match_id),
      leg2MatchId: resolveMatchId(row.leg2_match_id),
      overrideScoreA: row.override_score_a,
      overrideScoreB: row.override_score_b,
      winnerPlayerId: row.winner_player_id
        ? resolvePlayerId(row.winner_player_id)
        : null,
      notes: row.notes ?? null,
    };
  });

  const fundMonthDomainIdByUuid = new Map<string, string>();
  const fundMonths: FundMonth[] = (rows.fund_months ?? []).map((row) => {
    const year = seasonYearByUuid.get(row.season_id);
    const domainId = year ? `fm-${year}-${row.month_number}` : row.id;
    fundMonthDomainIdByUuid.set(row.id, domainId);
    return {
      id: domainId,
      seasonId: resolveSeasonId(row.season_id),
      monthNumber: row.month_number,
      monthLabel: row.month_label,
      feeAmount: parseRequiredNumber(row.fee_amount),
    };
  });

  const fundPayments: FundPayment[] = (rows.fund_payments ?? []).map((row) => {
    const fmDomainId =
      fundMonthDomainIdByUuid.get(row.fund_month_id) ?? row.fund_month_id;
    const playerDomainId = resolvePlayerId(row.player_id);
    return {
      id: `fp-${fmDomainId}-${playerDomainId}`,
      fundMonthId: fmDomainId,
      playerId: playerDomainId,
      paid: row.paid,
      ...(row.paid_at ? { paidAt: row.paid_at } : {}),
    };
  });

  const fundTransactions: FundTransaction[] = (
    rows.fund_transactions ?? []
  ).map((row) => ({
    id: row.external_key || row.id,
    seasonId: resolveSeasonId(row.season_id),
    txType: row.tx_type,
    amount: parseRequiredNumber(row.amount),
    description: row.description,
    txDate: row.tx_date,
  }));

  return {
    seasons,
    players,
    aliases,
    titles,
    matches,
    calendarEvents,
    announcements,
    cupEditions,
    cupTies,
    fundMonths,
    fundPayments,
    fundTransactions,
  };
}
