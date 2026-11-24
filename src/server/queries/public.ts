import "server-only";
import { unstable_cache } from "next/cache";
import {
  computeStandings,
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
  ResolvedCupTie,
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
