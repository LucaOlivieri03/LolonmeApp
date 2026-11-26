export interface MatchScoreDisplayInput {
  matchDate: string;
  teamAScore: number | null;
  teamBScore: number | null;
  resultOutcome: "A" | "B" | "draw" | null;
}

export interface PlayerMatchStatsDisplayInput {
  matchDate: string;
  matchType?: string;
  goals: number;
  assists: number;
}

export function getMatchYear(matchDate: string): number {
  const year = Number(matchDate.slice(0, 4));
  return Number.isFinite(year) ? year : 0;
}

/**
 * Returns the badge text for a match score, or null when the badge should be omitted.
 * In 2025 matches without exact scores, "Ganó Eq. A" is omitted because Team A is always the winner.
 */
export function formatMatchScoreBadge(m: MatchScoreDisplayInput): string | null {
  if (m.teamAScore !== null && m.teamBScore !== null) {
    return `${m.teamAScore} – ${m.teamBScore}`;
  }
  if (m.resultOutcome === "draw") return "Empate";
  if (m.resultOutcome === "A") {
    return getMatchYear(m.matchDate) <= 2025 ? null : "Ganó Eq. A";
  }
  if (m.resultOutcome === "B") return "Ganó Eq. B";
  return null;
}

/**
 * Returns whether to render the "{goals}G / {assists}A" stat label for a player in a match.
 * From 2026 onward, 0G / 0A is shown explicitly for regular matches.
 */
export function shouldShowGoalsAssists(input: PlayerMatchStatsDisplayInput): boolean {
  if (input.goals > 0 || input.assists > 0) return true;
  if (getMatchYear(input.matchDate) >= 2026 && input.matchType !== "special_f11") {
    return true;
  }
  return false;
}
