import type { Match, Player, PlayerTitle } from "@/lib/types/domain";
import { getMatchOutcome, getTeamResult } from "./outcome";

export interface StandingsRow {
  position: number;
  playerId: string;
  displayName: string;
  nickname?: string | null;
  points: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  winRate: number; // 0..100
  totalPjAllMatches: number;
  mvps: number;
  goals: number;
  assists: number;
  goalContributions: number;
  avgRating: number | null;
  totalRating: number;
  ratedMatches: number;
  stars: number;
}

export interface StandingsResult {
  rows: StandingsRow[];
  needsTitleTiebreaker: boolean;
}

export interface ComputeStandingsInput {
  players: Player[];
  matches: Match[];
  titles: PlayerTitle[];
  seasonId?: string; // omit for Historical Standings
}

function buildH2HMap(matches: Match[]): Map<string, number> {
  // key: `${aId}|${bId}` -> net balance (winsA - winsB)
  const h2h = new Map<string, number>();

  for (const match of matches) {
    if (!match.countsForStats) continue;
    const outcome = getMatchOutcome(match);
    if (!outcome || outcome === "draw") continue;

    const teamA = match.players.filter((p) => p.team === "A");
    const teamB = match.players.filter((p) => p.team === "B");

    for (const a of teamA) {
      for (const b of teamB) {
        const deltaA = outcome === "A" ? 1 : -1;
        const keyAB = `${a.playerId}|${b.playerId}`;
        const keyBA = `${b.playerId}|${a.playerId}`;
        h2h.set(keyAB, (h2h.get(keyAB) ?? 0) + deltaA);
        h2h.set(keyBA, (h2h.get(keyBA) ?? 0) - deltaA);
      }
    }
  }

  return h2h;
}

export function computeStandings({
  players,
  matches,
  titles,
  seasonId,
}: ComputeStandingsInput): StandingsResult {
  const scopedMatches = seasonId
    ? matches.filter((m) => m.seasonId === seasonId)
    : matches;

  const starsByPlayer = new Map<string, number>();
  for (const title of titles) {
    starsByPlayer.set(
      title.playerId,
      (starsByPlayer.get(title.playerId) ?? 0) + 1
    );
  }

  const acc = new Map<
    string,
    {
      player: Player;
      points: number;
      pj: number;
      pg: number;
      pe: number;
      pp: number;
      totalPjAllMatches: number;
      mvps: number;
      goals: number;
      assists: number;
      totalRating: number;
      ratedMatches: number;
    }
  >();

  for (const player of players) {
    acc.set(player.id, {
      player,
      points: 0,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      totalPjAllMatches: 0,
      mvps: 0,
      goals: 0,
      assists: 0,
      totalRating: 0,
      ratedMatches: 0,
    });
  }

  for (const match of scopedMatches) {
    const outcome = getMatchOutcome(match);

    for (const mp of match.players) {
      const entry = acc.get(mp.playerId);
      if (!entry) continue;

      if (match.countsForStats) {
        entry.totalPjAllMatches += 1;
        entry.goals += mp.goals;
        entry.assists += mp.assists;
        if (mp.isMvp) entry.mvps += 1;
        if (mp.adminRating !== null && mp.adminRating !== undefined) {
          entry.totalRating += mp.adminRating;
          entry.ratedMatches += 1;
        }
      }

      if (!match.countsForLeague || !outcome) continue;
      if (match.matchType === "lolonmebol") continue;

      const teamResult = getTeamResult(outcome, mp.team);
      if (!teamResult) continue;

      if (match.matchType === "cup") {
        // Cup captains get 0 pts and 0 PJ in League table
        if (mp.isCupCaptain) continue;
        entry.pj += 1;
        if (teamResult === "win") {
          entry.points += 4;
          entry.pg += 1;
        } else if (teamResult === "draw") {
          entry.points += 2;
          entry.pe += 1;
        } else {
          entry.pp += 1;
        }
      } else {
        // League, league_tiebreaker, or special_f11 with countsForLeague=true
        entry.pj += 1;
        if (teamResult === "win") {
          entry.points += 3;
          entry.pg += 1;
        } else if (teamResult === "draw") {
          entry.points += 1;
          entry.pe += 1;
        } else {
          entry.pp += 1;
        }
      }
    }
  }

  const h2h = buildH2HMap(scopedMatches);

  const rows: StandingsRow[] = Array.from(acc.values())
    .filter((e) => e.pj > 0 || e.totalPjAllMatches > 0 || (starsByPlayer.get(e.player.id) ?? 0) > 0)
    .map((e) => ({
      position: 0,
      playerId: e.player.id,
      displayName: e.player.displayName,
      nickname: e.player.nickname,
      points: e.points,
      pj: e.pj,
      pg: e.pg,
      pe: e.pe,
      pp: e.pp,
      winRate: e.pj > 0 ? (e.pg / e.pj) * 100 : 0,
      totalPjAllMatches: e.totalPjAllMatches,
      mvps: e.mvps,
      goals: e.goals,
      assists: e.assists,
      goalContributions: e.goals + e.assists,
      avgRating:
        e.ratedMatches > 0 ? e.totalRating / e.ratedMatches : null,
      totalRating: e.totalRating,
      ratedMatches: e.ratedMatches,
      stars: starsByPlayer.get(e.player.id) ?? 0,
    }));

  // Strict tiebreaker chain:
  // 1. Pts DESC -> 2. PJ ASC -> 3. Direct H2H DESC -> 4. PG% DESC -> 5. MVPs DESC -> 6. Name ASC
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.pj !== b.pj) return a.pj - b.pj;
    const h2hDelta = h2h.get(`${a.playerId}|${b.playerId}`) ?? 0;
    if (h2hDelta !== 0) return -h2hDelta;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.mvps !== a.mvps) return b.mvps - a.mvps;
    return a.displayName.localeCompare(b.displayName, "es");
  });

  rows.forEach((row, index) => {
    row.position = index + 1;
  });

  const needsTitleTiebreaker =
    rows.length >= 2 && rows[0].points > 0 && rows[0].points === rows[1].points;

  return { rows, needsTitleTiebreaker };
}
