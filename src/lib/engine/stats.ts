import type { Match, MatchModality, MatchType } from "@/lib/types/domain";
import type { StatsCompetitionFilter } from "@/lib/types/view-models";
import { getMatchOutcome, getTeamResult } from "./outcome";

export type { StatsCompetitionFilter };

export interface StatsFilter {
  seasonId?: string;
  modality?: MatchModality | "ALL";
  matchType?: StatsCompetitionFilter;
}

export interface PairwiseStats {
  playerAId: string;
  playerBId: string;
  matchesTogether: number;
  winsTogether: number;
  drawsTogether: number;
  lossesTogether: number;
  chemistryPct: number;
  wilsonCtPct: number;
  effectiveness310Pct: number;
  matchesAgainst: number;
  winsA: number;
  winsB: number;
  drawsAgainst: number;
  h2hBalance: number;
}

export interface SubgroupStats {
  playerIds: string[];
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  chemistryPct: number;
  wilsonCtPct: number;
  effectiveness310Pct: number;
}

const WILSON_Z = 1.28;
const WILSON_Z2 = WILSON_Z * WILSON_Z; // 1.6384

/**
 * Wilson Score lower bound at 80% confidence (z = 1.28)
 */
export function computeWilsonConsistency(wins: number, n: number): number {
  if (n <= 0) return 0;
  const p = wins / n;
  const numerator =
    p +
    WILSON_Z2 / (2 * n) -
    WILSON_Z * Math.sqrt((p * (1 - p)) / n + WILSON_Z2 / (4 * n * n));
  const denominator = 1 + WILSON_Z2 / n;
  const value = (numerator / denominator) * 100;
  return Math.max(0, Math.min(100, value));
}

export function computeEffectiveness310(
  wins: number,
  draws: number,
  n: number
): number {
  if (n <= 0) return 0;
  return ((wins * 3 + draws) / (n * 3)) * 100;
}

/**
 * Points scale for Effectiveness (#41):
 * - Cup matches: 4 win / 2 draw / 0 loss (counted for captains too)
 * - League / LOLONMEBOL / other matches: 3 win / 1 draw / 0 loss
 */
function getEffectivenessMatchPoints(
  matchType: MatchType,
  result: "win" | "draw" | "loss"
): { earned: number; max: number } {
  if (matchType === "cup") {
    return {
      earned: result === "win" ? 4 : result === "draw" ? 2 : 0,
      max: 4,
    };
  }
  return {
    earned: result === "win" ? 3 : result === "draw" ? 1 : 0,
    max: 3,
  };
}

export function filterStatsMatches(
  matches: Match[],
  filter?: StatsFilter
): Match[] {
  return matches.filter((m) => {
    if (!m.countsForStats) return false;
    if (filter?.seasonId && m.seasonId !== filter.seasonId) return false;
    if (filter?.modality && filter.modality !== "ALL" && m.modality !== filter.modality) {
      return false;
    }
    if (filter?.matchType && filter.matchType !== "ALL") {
      if (filter.matchType === "league") {
        if (m.matchType !== "league" && m.matchType !== "league_tiebreaker") {
          return false;
        }
      } else if (m.matchType !== filter.matchType) {
        return false;
      }
    }
    return true;
  });
}

export function computePairwiseStats(
  playerAId: string,
  playerBId: string,
  matches: Match[],
  filter?: StatsFilter
): PairwiseStats {
  const scoped = filterStatsMatches(matches, filter);

  let matchesTogether = 0;
  let winsTogether = 0;
  let drawsTogether = 0;
  let lossesTogether = 0;
  let earnedEffectivenessPts = 0;
  let maxEffectivenessPts = 0;

  let matchesAgainst = 0;
  let winsA = 0;
  let winsB = 0;
  let drawsAgainst = 0;

  for (const match of scoped) {
    const outcome = getMatchOutcome(match);
    if (!outcome) continue;

    const entryA = match.players.find((p) => p.playerId === playerAId);
    const entryB = match.players.find((p) => p.playerId === playerBId);
    if (!entryA || !entryB) continue;

    if (entryA.team === entryB.team) {
      matchesTogether += 1;
      const res = getTeamResult(outcome, entryA.team);
      if (res === "win") winsTogether += 1;
      else if (res === "draw") drawsTogether += 1;
      else if (res === "loss") lossesTogether += 1;
      if (res) {
        const pts = getEffectivenessMatchPoints(match.matchType, res);
        earnedEffectivenessPts += pts.earned;
        maxEffectivenessPts += pts.max;
      }
    } else {
      matchesAgainst += 1;
      const resA = getTeamResult(outcome, entryA.team);
      if (resA === "win") winsA += 1;
      else if (resA === "loss") winsB += 1;
      else if (resA === "draw") drawsAgainst += 1;
    }
  }

  return {
    playerAId,
    playerBId,
    matchesTogether,
    winsTogether,
    drawsTogether,
    lossesTogether,
    chemistryPct:
      matchesTogether > 0 ? (winsTogether / matchesTogether) * 100 : 0,
    wilsonCtPct: computeWilsonConsistency(winsTogether, matchesTogether),
    effectiveness310Pct:
      maxEffectivenessPts > 0
        ? (earnedEffectivenessPts / maxEffectivenessPts) * 100
        : 0,
    matchesAgainst,
    winsA,
    winsB,
    drawsAgainst,
    h2hBalance: winsA - winsB,
  };
}

export function computeSubgroupStats(
  playerIds: string[],
  matches: Match[],
  filter?: StatsFilter
): SubgroupStats {
  const uniqueIds = Array.from(new Set(playerIds));
  if (uniqueIds.length === 0) {
    return {
      playerIds: [],
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      chemistryPct: 0,
      wilsonCtPct: 0,
      effectiveness310Pct: 0,
    };
  }

  const scoped = filterStatsMatches(matches, filter);
  let matchesPlayed = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let earnedEffectivenessPts = 0;
  let maxEffectivenessPts = 0;

  for (const match of scoped) {
    const outcome = getMatchOutcome(match);
    if (!outcome) continue;

    const entries = uniqueIds.map((id) =>
      match.players.find((p) => p.playerId === id)
    );
    if (entries.some((e) => !e)) continue;

    const firstTeam = entries[0]!.team;
    if (!entries.every((e) => e!.team === firstTeam)) continue;

    matchesPlayed += 1;
    const res = getTeamResult(outcome, firstTeam);
    if (res === "win") wins += 1;
    else if (res === "draw") draws += 1;
    else if (res === "loss") losses += 1;
    if (res) {
      const pts = getEffectivenessMatchPoints(match.matchType, res);
      earnedEffectivenessPts += pts.earned;
      maxEffectivenessPts += pts.max;
    }
  }

  return {
    playerIds: uniqueIds,
    matchesPlayed,
    wins,
    draws,
    losses,
    chemistryPct: matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0,
    wilsonCtPct: computeWilsonConsistency(wins, matchesPlayed),
    effectiveness310Pct:
      maxEffectivenessPts > 0
        ? (earnedEffectivenessPts / maxEffectivenessPts) * 100
        : 0,
  };
}
