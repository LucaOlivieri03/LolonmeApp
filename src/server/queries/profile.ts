import "server-only";
import { unstable_cache } from "next/cache";
import { computeStandings, resolveDefaultSeasonId } from "@/lib/engine";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  ProfileRecentMatchItem,
  ProfileViewModel,
} from "@/lib/types/view-models";
import { getViewerSession, type ViewerSession } from "@/server/auth";
import {
  getPublicTournamentRepository,
  type PublicTournamentData,
  type PublicTournamentRepository,
} from "@/server/repositories";
import { CACHE_TAGS } from "./tags";

const DEFAULT_REVALIDATE_SECONDS = 60;

/**
 * Pure server-side projection builder for `/perfil` when a linked player session exists.
 */
export function buildLinkedProfileViewModel(
  session: ViewerSession,
  data: PublicTournamentData
): Extract<ProfileViewModel, { status: "linked" }> {
  const playerId = session.playerId!;
  const sortedSeasons = [...data.seasons].sort((a, b) => b.year - a.year);
  const activeSeasonId = resolveDefaultSeasonId(sortedSeasons);
  const activeSeason = sortedSeasons.find((s) => s.id === activeSeasonId);

  const historicalStandings = computeStandings({
    players: data.players,
    matches: data.matches,
    titles: data.titles,
  });

  const annualStandings = computeStandings({
    players: data.players,
    matches: data.matches,
    titles: data.titles,
    seasonId: activeSeasonId || undefined,
  });

  const linkedPlayer = data.players.find((p) => p.id === playerId) ?? null;

  const historicalRow =
    historicalStandings.rows.find((r) => r.playerId === playerId) ?? null;
  const annualRow =
    annualStandings.rows.find((r) => r.playerId === playerId) ?? null;

  const titles = data.titles
    .filter((t) => t.playerId === playerId)
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));

  const recentMatches: ProfileRecentMatchItem[] = [];
  for (const match of data.matches) {
    const mp = match.players.find((p) => p.playerId === playerId);
    if (!mp) continue;
    recentMatches.push({
      id: match.id,
      matchNumber: match.matchNumber,
      matchDate: match.matchDate,
      ...(match.notes !== undefined && match.notes !== null
        ? { notes: match.notes }
        : {}),
      team: mp.team,
      isMvp: mp.isMvp,
      goals: mp.goals,
      assists: mp.assists,
      adminRating: mp.adminRating,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      resultOutcome: match.resultOutcome ?? null,
    });
    if (recentMatches.length >= 6) break;
  }

  const effectiveRole =
    session.role === "guest" ? "player" : session.role;

  return {
    status: "linked",
    player: {
      id: linkedPlayer?.id ?? playerId,
      displayName:
        linkedPlayer?.displayName ?? session.displayName ?? playerId,
      ...(linkedPlayer?.nickname !== undefined &&
      linkedPlayer?.nickname !== null
        ? { nickname: linkedPlayer.nickname }
        : {}),
      role: effectiveRole,
      email: session.email,
    },
    activeSeasonName: activeSeason?.name ?? "Temporada Actual",
    annualRow,
    historicalRow,
    titles,
    recentMatches,
  };
}

/**
 * Resolves the `/perfil` view model across the 3 session states (`guest`, `unlinked`, `linked`).
 * Skips loading tournament data entirely when the visitor is `guest` or `unlinked`.
 */
export async function loadProfileViewModel(
  session: ViewerSession,
  repo: PublicTournamentRepository,
  options?: { isAuthConfigured?: boolean }
): Promise<ProfileViewModel> {
  if (!session.userId) {
    return {
      status: "guest",
      isAuthConfigured: options?.isAuthConfigured ?? isSupabaseConfigured(),
    };
  }

  if (!session.playerId || session.role === "guest") {
    return {
      status: "unlinked",
      email: session.email,
    };
  }

  const data = await repo.getPublicDataset();
  return buildLinkedProfileViewModel(session, data);
}

const getCachedPublicDatasetForProfile = unstable_cache(
  async () => getPublicTournamentRepository().getPublicDataset(),
  ["public:profile-dataset"],
  {
    revalidate: DEFAULT_REVALIDATE_SECONDS,
    tags: [CACHE_TAGS.seasons, CACHE_TAGS.players, CACHE_TAGS.matches],
  }
);

/**
 * SSR entry point for `/perfil`.
 * Reads HTTP-only session cookies per request (never cached across users) and
 * combines linked players with the tagged public tournament cache.
 */
export async function getAuthenticatedProfileViewModel(): Promise<ProfileViewModel> {
  const session = await getViewerSession();

  if (!session.userId) {
    return {
      status: "guest",
      isAuthConfigured: isSupabaseConfigured(),
    };
  }

  if (!session.playerId || session.role === "guest") {
    return {
      status: "unlinked",
      email: session.email,
    };
  }

  const data = await getCachedPublicDatasetForProfile();
  return buildLinkedProfileViewModel(session, data);
}
