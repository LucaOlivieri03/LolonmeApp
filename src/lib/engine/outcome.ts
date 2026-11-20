import type { Match } from "@/lib/types/domain";

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
