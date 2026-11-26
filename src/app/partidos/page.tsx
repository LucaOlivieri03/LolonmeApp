import { PartidosInteractiveView } from "@/components/matches/PartidosInteractiveView";
import type { MatchType } from "@/lib/types/domain";
import { getViewerSession } from "@/server/auth";
import {
  getMatchesViewModel,
  getMatchVotingMapForMatches,
} from "@/server/queries";

interface PartidosPageProps {
  searchParams: Promise<{
    season?: string;
    type?: string;
    date?: string;
    number?: string;
    player?: string;
  }>;
}

const VALID_MATCH_TYPES = new Set<MatchType>([
  "league",
  "league_tiebreaker",
  "cup",
  "special_f11",
  "lolonmebol",
]);

function parseSeasonParam(raw: string | undefined): number | "all" | undefined {
  if (!raw) return undefined;
  if (raw.toLowerCase() === "all") return "all";
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : undefined;
}

function parseMatchTypeParam(raw: string | undefined): MatchType | "ALL" {
  if (raw && VALID_MATCH_TYPES.has(raw as MatchType)) {
    return raw as MatchType;
  }
  return "ALL";
}

function parseDateParam(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}(-\d{2})?$/.test(trimmed) ? trimmed : "";
}

export default async function PartidosPage({
  searchParams,
}: PartidosPageProps) {
  const params = await searchParams;

  const [viewModel, session] = await Promise.all([
    getMatchesViewModel({
      seasonFilter: parseSeasonParam(params.season),
      matchType: parseMatchTypeParam(params.type),
      dateFilter: parseDateParam(params.date),
      matchNumberQuery: params.number?.trim() ?? "",
      playerId: params.player?.trim() ?? "ALL",
    }),
    getViewerSession(),
  ]);

  const votingByMatchId = await getMatchVotingMapForMatches(
    viewModel.matches,
    session
  );

  return (
    <PartidosInteractiveView
      seasons={viewModel.seasons}
      selectedSeasonId={viewModel.selectedSeasonId}
      selectedType={viewModel.selectedType}
      dateFilter={viewModel.dateFilter}
      matchNumberQuery={viewModel.matchNumberQuery}
      playerFilterId={viewModel.playerFilterId}
      availableMatchNumbers={viewModel.availableMatchNumbers}
      playerOptions={viewModel.playerOptions}
      matches={viewModel.matches}
      votingByMatchId={votingByMatchId}
      viewerPlayerId={session.playerId}
      isAdmin={session.role === "admin"}
      isOperator={session.role === "admin" || session.role === "authorized"}
    />
  );
}
