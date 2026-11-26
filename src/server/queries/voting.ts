import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MatchVote } from "@/lib/types/domain";
import type {
  MatchLedgerItem,
  MatchVotingSummary,
} from "@/lib/types/view-models";
import { buildMatchVotingSummary } from "@/lib/voting/engine";
import type { ViewerSession } from "@/server/auth";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Loads session-scoped match votes for the visible matches in `/partidos`.
 * Uses the authenticated SSR Supabase client so PostgreSQL RLS enforces
 * participant privacy while voting is `open` and full transparency when `closed`.
 */
export async function getMatchVotingMapForMatches(
  matches: MatchLedgerItem[],
  session: ViewerSession
): Promise<Record<string, MatchVotingSummary>> {
  const summaries: Record<string, MatchVotingSummary> = {};
  if (matches.length === 0) return summaries;

  const isAdmin = session.role === "admin";
  const viewerPlayerId = session.playerId;

  const buildEmptyMap = (): Record<string, MatchVotingSummary> => {
    for (const match of matches) {
      summaries[match.id] = buildMatchVotingSummary({
        matchId: match.id,
        votingStatus: match.votingStatus,
        roster: [...match.teamA, ...match.teamB],
        votes: [],
        viewerPlayerId,
        isAdmin,
      });
    }
    return summaries;
  };

  const client = await createSupabaseServerClient();
  if (!client) {
    return buildEmptyMap();
  }

  try {
    const matchUuids: string[] = [];
    const matchSlugs: string[] = [];
    for (const m of matches) {
      if (UUID_REGEX.test(m.id)) {
        matchUuids.push(m.id);
      } else {
        matchSlugs.push(m.id);
      }
    }

    const dbUuidToDomainMatchId = new Map<string, string>();
    const allDbMatchUuids: string[] = [];

    if (matchUuids.length > 0) {
      for (const id of matchUuids) {
        dbUuidToDomainMatchId.set(id, id);
        allDbMatchUuids.push(id);
      }
    }

    if (matchSlugs.length > 0) {
      const { data: matchRows } = await client
        .from("matches")
        .select("id, slug")
        .in("slug", matchSlugs);

      for (const row of (matchRows ?? []) as Array<{
        id: string;
        slug: string | null;
      }>) {
        const domainId = row.slug ?? row.id;
        dbUuidToDomainMatchId.set(row.id, domainId);
        allDbMatchUuids.push(row.id);
      }
    }

    if (allDbMatchUuids.length === 0) {
      return buildEmptyMap();
    }

    const { data: voteRows, error: votesError } = await client
      .from("match_votes")
      .select("id, match_id, voter_player_id, target_player_id, rating, voted_mvp, created_at")
      .in("match_id", allDbMatchUuids);

    if (votesError || !voteRows || voteRows.length === 0) {
      return buildEmptyMap();
    }

    const typedVotes = voteRows as Array<{
      id: string;
      match_id: string;
      voter_player_id: string;
      target_player_id: string;
      rating: number | string;
      voted_mvp: boolean;
      created_at?: string;
    }>;

    const playerUuids = new Set<string>();
    for (const row of typedVotes) {
      playerUuids.add(row.voter_player_id);
      playerUuids.add(row.target_player_id);
    }

    const dbUuidToDomainPlayerId = new Map<string, string>();
    if (playerUuids.size > 0) {
      const { data: playerRows } = await client
        .from("players")
        .select("id, slug")
        .in("id", Array.from(playerUuids));

      for (const row of (playerRows ?? []) as Array<{
        id: string;
        slug: string | null;
      }>) {
        dbUuidToDomainPlayerId.set(row.id, row.slug ?? row.id);
      }
    }

    const votesByDomainMatchId = new Map<string, MatchVote[]>();
    for (const row of typedVotes) {
      const domainMatchId = dbUuidToDomainMatchId.get(row.match_id) ?? row.match_id;
      const list = votesByDomainMatchId.get(domainMatchId) ?? [];
      list.push({
        id: row.id,
        matchId: domainMatchId,
        voterPlayerId:
          dbUuidToDomainPlayerId.get(row.voter_player_id) ?? row.voter_player_id,
        targetPlayerId:
          dbUuidToDomainPlayerId.get(row.target_player_id) ?? row.target_player_id,
        rating: Number(row.rating),
        votedMvp: Boolean(row.voted_mvp),
        createdAt: row.created_at,
      });
      votesByDomainMatchId.set(domainMatchId, list);
    }

    for (const match of matches) {
      summaries[match.id] = buildMatchVotingSummary({
        matchId: match.id,
        votingStatus: match.votingStatus,
        roster: [...match.teamA, ...match.teamB],
        votes: votesByDomainMatchId.get(match.id) ?? [],
        viewerPlayerId,
        isAdmin,
      });
    }

    return summaries;
  } catch {
    return buildEmptyMap();
  }
}
