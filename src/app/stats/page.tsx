import {
  StatsInteractiveView,
  type StatsTab,
} from "@/components/stats/StatsInteractiveView";
import type { StatsCompetitionFilter } from "@/lib/engine";
import type { MatchModality } from "@/lib/types/domain";
import { getViewerSession } from "@/server/auth";
import { getStatsViewModel } from "@/server/queries";

interface StatsPageProps {
  searchParams: Promise<{
    tab?: string;
    season?: string;
    modality?: string;
    type?: string;
    all?: string;
    lab?: string;
    player?: string;
  }>;
}

const VALID_MODALITIES = new Set<MatchModality>(["F5", "F6", "F7"]);
const VALID_COMPETITIONS = new Set<StatsCompetitionFilter>([
  "league",
  "cup",
  "lolonmebol",
]);

function parseCompetitionParam(
  raw: string | undefined
): StatsCompetitionFilter {
  if (raw && VALID_COMPETITIONS.has(raw as StatsCompetitionFilter)) {
    return raw as StatsCompetitionFilter;
  }
  return "ALL";
}

function parseTabParam(raw: string | undefined): StatsTab {
  return raw === "player" ? "player" : "lab";
}

function parseSeasonParam(raw: string | undefined): number | "all" {
  if (!raw || raw.toLowerCase() === "all") return "all";
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : "all";
}

function parseModalityParam(raw: string | undefined): MatchModality | "ALL" {
  if (raw && VALID_MODALITIES.has(raw as MatchModality)) {
    return raw as MatchModality;
  }
  return "ALL";
}

function parseLabParam(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return [];
  return trimmed
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  const [params, session] = await Promise.all([
    searchParams,
    getViewerSession(),
  ]);

  const initialTab = parseTabParam(params.tab);
  const viewModel = await getStatsViewModel({
    seasonFilter: parseSeasonParam(params.season),
    modality: parseModalityParam(params.modality),
    matchType: parseCompetitionParam(params.type),
    includeLowSample: params.all === "1" || params.all === "true",
    labPlayerIds: parseLabParam(params.lab),
    playerId: params.player?.trim() || session.playerId || undefined,
  });

  return (
    <StatsInteractiveView
      initialTab={initialTab}
      seasons={viewModel.seasons}
      selectedSeasonId={viewModel.selectedSeasonId}
      selectedModality={viewModel.selectedModality}
      selectedMatchType={viewModel.selectedMatchType}
      includeLowSample={viewModel.includeLowSample}
      activePlayers={viewModel.activePlayers}
      lab={viewModel.lab}
      profile={viewModel.profile}
      viewerPlayerId={session.playerId}
    />
  );
}
