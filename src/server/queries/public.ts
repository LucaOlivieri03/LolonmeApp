import "server-only";
import { unstable_cache } from "next/cache";
import {
  computePairwiseStats,
  computeStandings,
  computeSubgroupStats,
  filterMatches,
  getCupTieAggregate,
  resolveCupTieWinner,
  resolveDefaultSeasonId,
} from "@/lib/engine";
import type { Season } from "@/lib/types/domain";
import {
  getPublicTournamentRepository,
  type PublicTournamentData,
  type PublicTournamentRepository,
} from "@/server/repositories";
import { CACHE_TAGS } from "./tags";
import type {
  CalendarEventItem,
  CalendarMonthGroup,
  CalendarViewModel,
  HomeViewModel,
  MatchLedgerItem,
  MatchLedgerPlayerItem,
  MatchesQueryFilters,
  MatchesViewModel,
  ResolvedCupTie,
  StatsActivePlayerOption,
  StatsLabPairwiseItem,
  StatsPairingItem,
  StatsQueryFilters,
  StatsViewModel,
} from "./types";

const DEFAULT_REVALIDATE_SECONDS = 60;

function sortSeasonsDescending(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) => b.year - a.year);
}

function resolveSeasonByYear(
  sortedSeasons: Season[],
  seasonYear?: number
): Season | null {
  if (sortedSeasons.length === 0) return null;
  if (typeof seasonYear === "number" && Number.isFinite(seasonYear)) {
    const matched = sortedSeasons.find((s) => s.year === seasonYear);
    if (matched) return matched;
  }
  const defaultId = resolveDefaultSeasonId(sortedSeasons);
  return sortedSeasons.find((s) => s.id === defaultId) ?? sortedSeasons[0];
}

/**
 * Pure server-side projection builder for the Home view.
 * Computes annual & historical standings and resolves cup ties on the server.
 */
export function buildHomeViewModel(
  data: PublicTournamentData,
  seasonYear?: number
): HomeViewModel {
  const seasons = sortSeasonsDescending(data.seasons);
  const activeSeason = resolveSeasonByYear(seasons, seasonYear);

  const annualStandings = computeStandings({
    players: data.players,
    matches: data.matches,
    titles: data.titles,
    seasonId: activeSeason?.id,
  });

  const historicalStandings = computeStandings({
    players: data.players,
    matches: data.matches,
    titles: data.titles,
  });

  const activeCupEdition = data.cupEditions.find(
    (edition) => edition.seasonId === activeSeason?.id
  );
  const rawCupTies = activeCupEdition
    ? data.cupTies.filter((tie) => tie.cupEditionId === activeCupEdition.id)
    : [];

  const playerNameById = new Map(
    data.players.map((player) => [player.id, player.displayName])
  );
  const nameOf = (id: string | null) =>
    id ? (playerNameById.get(id) ?? id) : "Por definir";

  const cupTies: ResolvedCupTie[] = rawCupTies.map((tie) => {
    const agg = getCupTieAggregate(tie, data.matches);
    const winnerId = resolveCupTieWinner(tie, data.matches);
    return {
      id: tie.id,
      round: tie.round,
      slotOrder: tie.slotOrder,
      playerAName: nameOf(tie.playerAId),
      playerBName: tie.playerBId
        ? nameOf(tie.playerBId)
        : tie.round === "quarterfinal" && tie.slotOrder === 1
          ? "Ganador Fase Previa"
          : "Por definir",
      seedA: tie.seedA,
      seedB: tie.seedB,
      scoreA: agg.hasScores ? agg.scoreA : null,
      scoreB: agg.hasScores ? agg.scoreB : null,
      hasScores: agg.hasScores,
      isAWin: Boolean(winnerId && winnerId === tie.playerAId),
      isBWin: Boolean(winnerId && winnerId === tie.playerBId),
      ...(tie.notes !== undefined && tie.notes !== null
        ? { notes: tie.notes }
        : {}),
    };
  });

  const seasonMatchesCount = activeSeason
    ? data.matches.filter((match) => match.seasonId === activeSeason.id).length
    : 0;

  const announcements = [...data.announcements].sort(
    (a, b) =>
      Number(b.isPinned) - Number(a.isPinned) ||
      b.createdAt.localeCompare(a.createdAt)
  );

  const latestEvent = data.calendarEvents[0] ?? null;

  return {
    seasons,
    activeSeason,
    annualStandings,
    historicalStandings,
    cupEditionName:
      activeCupEdition?.name ?? `Copa ${activeSeason?.year ?? ""}`.trim(),
    cupTies,
    seasonMatchesCount,
    announcements,
    latestEvent,
  };
}

/**
 * Pure server-side projection builder for the Calendar view.
 * Filters by season, attaches 4-field linked match summaries, and pre-groups events by month.
 */
export function buildCalendarViewModel(
  data: PublicTournamentData,
  seasonFilter?: number | "all"
): CalendarViewModel {
  const seasons = sortSeasonsDescending(data.seasons);

  let selectedSeasonId = "ALL";
  if (seasonFilter === "all") {
    selectedSeasonId = "ALL";
  } else if (
    typeof seasonFilter === "number" &&
    Number.isFinite(seasonFilter)
  ) {
    const matched = seasons.find((s) => s.year === seasonFilter);
    selectedSeasonId = matched?.id ?? seasons[0]?.id ?? "ALL";
  } else {
    selectedSeasonId = seasons[0]?.id ?? "ALL";
  }

  const matchSummaryById = new Map(
    data.matches.map((match) => [
      match.id,
      {
        modality: match.modality,
        matchNumber: match.matchNumber,
        teamAScore: match.teamAScore,
        teamBScore: match.teamBScore,
      },
    ])
  );

  const events: CalendarEventItem[] = data.calendarEvents
    .filter(
      (ev) => selectedSeasonId === "ALL" || ev.seasonId === selectedSeasonId
    )
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) || a.id.localeCompare(b.id)
    )
    .map((ev) => ({
      id: ev.id,
      seasonId: ev.seasonId,
      title: ev.title,
      ...(ev.description !== undefined && ev.description !== null
        ? { description: ev.description }
        : {}),
      eventDate: ev.eventDate,
      eventType: ev.eventType,
      ...(ev.matchId !== undefined && ev.matchId !== null
        ? { matchId: ev.matchId }
        : {}),
      linkedMatch: ev.matchId ? (matchSummaryById.get(ev.matchId) ?? null) : null,
    }));

  const monthMap = new Map<string, CalendarEventItem[]>();
  for (const ev of events) {
    const monthKey = ev.eventDate.slice(0, 7);
    const bucket = monthMap.get(monthKey);
    if (bucket) {
      bucket.push(ev);
    } else {
      monthMap.set(monthKey, [ev]);
    }
  }

  const groupedByMonth: CalendarMonthGroup[] = Array.from(monthMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthKey, monthEvents]) => ({
      monthKey,
      events: monthEvents,
    }));

  const activeSeason = seasons.find((s) => s.id === selectedSeasonId);
  const initialMonth =
    events[0]?.eventDate.slice(0, 7) ??
    (activeSeason ? `${activeSeason.year}-07` : new Date().toISOString().slice(0, 7));

  return {
    seasons,
    selectedSeasonId,
    events,
    groupedByMonth,
    initialMonth,
  };
}

export async function loadHomeViewModel(
  repo: PublicTournamentRepository,
  seasonYear?: number
): Promise<HomeViewModel> {
  const data = await repo.getPublicDataset();
  return buildHomeViewModel(data, seasonYear);
}

export async function loadCalendarViewModel(
  repo: PublicTournamentRepository,
  seasonFilter?: number | "all"
): Promise<CalendarViewModel> {
  const data = await repo.getPublicDataset();
  return buildCalendarViewModel(data, seasonFilter);
}

/**
 * Tagged cached server query for `/` (Home).
 */
export async function getHomeViewModel(
  seasonYear?: number
): Promise<HomeViewModel> {
  const cacheKey = seasonYear ? String(seasonYear) : "default";
  const cached = unstable_cache(
    async () =>
      loadHomeViewModel(getPublicTournamentRepository(), seasonYear),
    ["public:home-view-model", cacheKey],
    {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
      tags: [
        CACHE_TAGS.seasons,
        CACHE_TAGS.players,
        CACHE_TAGS.matches,
        CACHE_TAGS.cup,
        CACHE_TAGS.announcements,
        CACHE_TAGS.calendar,
      ],
    }
  );
  return cached();
}

/**
 * Tagged cached server query for `/calendario` (Calendar).
 */
export async function getCalendarViewModel(
  seasonFilter?: number | "all"
): Promise<CalendarViewModel> {
  const cacheKey = seasonFilter !== undefined ? String(seasonFilter) : "default";
  const cached = unstable_cache(
    async () =>
      loadCalendarViewModel(getPublicTournamentRepository(), seasonFilter),
    ["public:calendar-view-model", cacheKey],
    {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
      tags: [CACHE_TAGS.seasons, CACHE_TAGS.matches, CACHE_TAGS.calendar],
    }
  );
  return cached();
}

/**
 * Pure server-side projection builder for `/partidos` (Matchday Ledger).
 * Filters matches on the server and pre-resolves player display names & rosters.
 */
export function buildMatchesViewModel(
  data: PublicTournamentData,
  filters: MatchesQueryFilters = {}
): MatchesViewModel {
  const seasons = sortSeasonsDescending(data.seasons);

  let selectedSeasonId = "ALL";
  if (filters.seasonFilter === "all") {
    selectedSeasonId = "ALL";
  } else if (
    typeof filters.seasonFilter === "number" &&
    Number.isFinite(filters.seasonFilter)
  ) {
    const matched = seasons.find((s) => s.year === filters.seasonFilter);
    selectedSeasonId = matched?.id ?? seasons[0]?.id ?? "ALL";
  } else {
    selectedSeasonId = seasons[0]?.id ?? "ALL";
  }

  const playerNameById = new Map(
    data.players.map((player) => [player.id, player.displayName])
  );
  const nameOf = (id: string) => playerNameById.get(id) ?? id;

  const selectedType = filters.matchType ?? "ALL";
  const dateFilter = (filters.dateFilter ?? "").trim();
  const matchNumberQuery = (filters.matchNumberQuery ?? "").trim();
  const rawPlayerId = (filters.playerId ?? "").trim();
  const playerFilterId =
    rawPlayerId && rawPlayerId !== "ALL" && playerNameById.has(rawPlayerId)
      ? rawPlayerId
      : "ALL";

  const availableMatchNumbersSet = new Set<number>();
  for (const match of data.matches) {
    if (selectedSeasonId !== "ALL" && match.seasonId !== selectedSeasonId) {
      continue;
    }
    if (match.matchNumber !== null) {
      availableMatchNumbersSet.add(match.matchNumber);
    }
  }
  const availableMatchNumbers = Array.from(availableMatchNumbersSet).sort(
    (a, b) => a - b
  );

  const filteredMatches = filterMatches(data.matches, {
    seasonId: selectedSeasonId,
    matchType: selectedType,
    dateFilter,
    matchNumberQuery,
    playerId: playerFilterId,
  });

  const matches: MatchLedgerItem[] = filteredMatches.map((match) => {
    const teamA: MatchLedgerPlayerItem[] = [];
    const teamB: MatchLedgerPlayerItem[] = [];
    const mvpNames: string[] = [];

    for (const mp of match.players) {
      const displayName = nameOf(mp.playerId);
      const item: MatchLedgerPlayerItem = {
        id: mp.id,
        playerId: mp.playerId,
        displayName,
        team: mp.team,
        goals: mp.goals,
        assists: mp.assists,
        isMvp: mp.isMvp,
        isCupCaptain: mp.isCupCaptain,
        adminRating: mp.adminRating,
        pitchX: mp.pitchX ?? null,
        pitchY: mp.pitchY ?? null,
      };
      if (mp.team === "A") {
        teamA.push(item);
      } else {
        teamB.push(item);
      }
      if (mp.isMvp) {
        mvpNames.push(displayName);
      }
    }

    return {
      id: match.id,
      seasonId: match.seasonId,
      matchDate: match.matchDate,
      matchType: match.matchType,
      modality: match.modality,
      matchNumber: match.matchNumber,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      resultOutcome: match.resultOutcome ?? null,
      votingStatus: match.votingStatus,
      ...(match.notes !== undefined && match.notes !== null
        ? { notes: match.notes }
        : {}),
      mvpNames,
      teamA,
      teamB,
    };
  });

  const playerOptions = [
    {
      id: "ALL",
      displayName: `Todos los jugadores (${data.players.length})`,
    },
    ...data.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
    })),
  ];

  return {
    seasons,
    selectedSeasonId,
    selectedType,
    dateFilter,
    matchNumberQuery,
    playerFilterId,
    availableMatchNumbers,
    playerOptions,
    matches,
  };
}

/**
 * Pure server-side projection builder for `/stats` (Statistics & Group Lab).
 * Computes standings, subgroup chemistry, Wilson CT%, and H2H pairwise matrices on the server.
 */
export function buildStatsViewModel(
  data: PublicTournamentData,
  filters: StatsQueryFilters = {}
): StatsViewModel {
  const seasons = sortSeasonsDescending(data.seasons);

  let selectedSeasonId = "ALL";
  if (
    typeof filters.seasonFilter === "number" &&
    Number.isFinite(filters.seasonFilter)
  ) {
    const matched = seasons.find((s) => s.year === filters.seasonFilter);
    selectedSeasonId = matched?.id ?? "ALL";
  }

  const selectedModality = filters.modality ?? "ALL";
  const selectedMatchType = filters.matchType ?? "ALL";
  const includeLowSample = Boolean(filters.includeLowSample);
  const minThreshold = includeLowSample ? 1 : 3;

  const historicalStandings = computeStandings({
    players: data.players,
    matches: data.matches,
    titles: data.titles,
  });

  const activeRows = historicalStandings.rows.filter(
    (row) => row.totalPjAllMatches >= minThreshold
  );

  const activePlayers: StatsActivePlayerOption[] = activeRows.map((p) => ({
    id: p.playerId,
    displayName: p.displayName,
    position: p.position,
    points: p.points,
    pj: p.pj,
    stars: p.stars,
  }));

  const playerNameById = new Map(
    data.players.map((player) => [player.id, player.displayName])
  );
  const nameOf = (id: string) => playerNameById.get(id) ?? id;

  const engineFilter = {
    seasonId: selectedSeasonId === "ALL" ? undefined : selectedSeasonId,
    modality: selectedModality,
    matchType: selectedMatchType,
  };

  // Lab Grupal computation
  const selectedLabPlayerIds =
    filters.labPlayerIds === undefined
      ? activePlayers.slice(0, 2).map((p) => p.id)
      : Array.from(
          new Set(
            filters.labPlayerIds.filter((id) => playerNameById.has(id))
          )
        );

  const selectedLabPlayerNames = selectedLabPlayerIds.map(nameOf);
  const labSubgroup =
    selectedLabPlayerIds.length >= 2
      ? computeSubgroupStats(selectedLabPlayerIds, data.matches, engineFilter)
      : null;

  let labPairwise: StatsLabPairwiseItem | null = null;
  if (selectedLabPlayerIds.length === 2) {
    const [playerAId, playerBId] = selectedLabPlayerIds;
    labPairwise = {
      playerAName: nameOf(playerAId),
      playerBName: nameOf(playerBId),
      stats: computePairwiseStats(
        playerAId,
        playerBId,
        data.matches,
        engineFilter
      ),
    };
  }

  // Player Profile computation
  const rawPlayerId = (filters.playerId ?? "").trim();
  const selectedPlayerId =
    rawPlayerId && playerNameById.has(rawPlayerId)
      ? rawPlayerId
      : (activePlayers[0]?.id ?? data.players[0]?.id ?? "");

  const scopedStandings =
    selectedSeasonId === "ALL"
      ? historicalStandings
      : computeStandings({
          players: data.players,
          matches: data.matches,
          titles: data.titles,
          seasonId: selectedSeasonId,
        });

  const profileRow =
    scopedStandings.rows.find((row) => row.playerId === selectedPlayerId) ??
    null;

  let bestTeammates: StatsPairingItem[] = [];
  let topRivals: StatsPairingItem[] = [];

  if (selectedPlayerId) {
    const others = activeRows.filter((p) => p.playerId !== selectedPlayerId);
    const pairs: StatsPairingItem[] = others.map((other) => ({
      playerId: other.playerId,
      displayName: other.displayName,
      stats: computePairwiseStats(
        selectedPlayerId,
        other.playerId,
        data.matches,
        engineFilter
      ),
    }));

    bestTeammates = [...pairs]
      .filter((x) => x.stats.matchesTogether >= minThreshold)
      .sort((a, b) => b.stats.wilsonCtPct - a.stats.wilsonCtPct)
      .slice(0, 6);

    topRivals = [...pairs]
      .filter((x) => x.stats.matchesAgainst >= minThreshold)
      .sort(
        (a, b) => Math.abs(b.stats.h2hBalance) - Math.abs(a.stats.h2hBalance)
      )
      .slice(0, 6);
  }

  return {
    seasons,
    selectedSeasonId,
    selectedModality,
    selectedMatchType,
    includeLowSample,
    activePlayers,
    lab: {
      selectedPlayerIds: selectedLabPlayerIds,
      selectedPlayerNames: selectedLabPlayerNames,
      subgroup: labSubgroup,
      pairwise: labPairwise,
    },
    profile: {
      selectedPlayerId,
      row: profileRow,
      bestTeammates,
      topRivals,
    },
  };
}

export async function loadMatchesViewModel(
  repo: PublicTournamentRepository,
  filters: MatchesQueryFilters = {}
): Promise<MatchesViewModel> {
  const data = await repo.getPublicDataset();
  return buildMatchesViewModel(data, filters);
}

export async function loadStatsViewModel(
  repo: PublicTournamentRepository,
  filters: StatsQueryFilters = {}
): Promise<StatsViewModel> {
  const data = await repo.getPublicDataset();
  return buildStatsViewModel(data, filters);
}

/**
 * Tagged cached server query for `/partidos`.
 */
export async function getMatchesViewModel(
  filters: MatchesQueryFilters = {}
): Promise<MatchesViewModel> {
  const cacheKey = JSON.stringify({
    s: filters.seasonFilter ?? "default",
    t: filters.matchType ?? "ALL",
    d: (filters.dateFilter ?? "").trim(),
    n: (filters.matchNumberQuery ?? "").trim(),
    p: (filters.playerId ?? "ALL").trim(),
  });

  const cached = unstable_cache(
    async () =>
      loadMatchesViewModel(getPublicTournamentRepository(), filters),
    ["public:matches-view-model", cacheKey],
    {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
      tags: [CACHE_TAGS.seasons, CACHE_TAGS.players, CACHE_TAGS.matches],
    }
  );
  return cached();
}

/**
 * Tagged cached server query for `/stats`.
 */
export async function getStatsViewModel(
  filters: StatsQueryFilters = {}
): Promise<StatsViewModel> {
  const cacheKey = JSON.stringify({
    s: filters.seasonFilter ?? "all",
    m: filters.modality ?? "ALL",
    l: filters.labPlayerIds === undefined ? "default" : filters.labPlayerIds,
    p: (filters.playerId ?? "").trim(),
  });

  const cached = unstable_cache(
    async () => loadStatsViewModel(getPublicTournamentRepository(), filters),
    ["public:stats-view-model", cacheKey],
    {
      revalidate: DEFAULT_REVALIDATE_SECONDS,
      tags: [CACHE_TAGS.seasons, CACHE_TAGS.players, CACHE_TAGS.matches],
    }
  );
  return cached();
}
