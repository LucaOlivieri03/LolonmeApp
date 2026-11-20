import type { Match, MatchType } from "@/lib/types/domain";

export type MatchOutcome = "A" | "B" | "draw" | null;

export function getMatchOutcome(match: Match): MatchOutcome {
  if (match.teamAScore !== null && match.teamBScore !== null) {
    if (match.teamAScore > match.teamBScore) return "A";
    if (match.teamBScore > match.teamAScore) return "B";
    return "draw";
  }
  return match.resultOutcome ?? null;
}

export function getTeamResult(
  outcome: MatchOutcome,
  team: "A" | "B"
): "win" | "draw" | "loss" | null {
  if (!outcome) return null;
  if (outcome === "draw") return "draw";
  return outcome === team ? "win" : "loss";
}

export function replaceMatchInDataset(
  matches: Match[],
  updatedMatch: Match
): Match[] {
  const normalized: Match = {
    ...updatedMatch,
    resultOutcome: getMatchOutcome(updatedMatch),
  };
  return matches
    .map((m) => (m.id === normalized.id ? normalized : m))
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate));
}

export interface MatchFilterOptions {
  seasonId: string;
  matchType: "ALL" | MatchType;
  dateFilter?: string;
  matchNumberQuery?: string;
  playerId?: string;
}

export function filterMatches(
  matches: Match[],
  options: MatchFilterOptions
): Match[] {
  const dateQ = (options.dateFilter ?? "").trim();
  const numQ = (options.matchNumberQuery ?? "")
    .trim()
    .replace(/^(fecha|#)\s*/i, "");
  const playerQ = (options.playerId ?? "").trim();

  return matches.filter((m) => {
    if (options.seasonId !== "ALL" && m.seasonId !== options.seasonId) {
      return false;
    }
    if (options.matchType !== "ALL" && m.matchType !== options.matchType) {
      return false;
    }
    if (dateQ && !m.matchDate.startsWith(dateQ)) {
      return false;
    }
    if (numQ) {
      if (m.matchNumber === null) return false;
      if (String(m.matchNumber) !== numQ) return false;
    }
    if (playerQ && playerQ !== "ALL") {
      if (!m.players.some((mp) => mp.playerId === playerQ)) {
        return false;
      }
    }
    return true;
  });
}
