import type { MatchVote, VotingStatus } from "@/lib/types/domain";
import type { MatchVoteEntryInput } from "@/lib/types/admin-actions";
import type {
  MatchLedgerPlayerItem,
  MatchTransparentBallot,
  MatchViewerBallotEntry,
  MatchVotePlayerSummary,
  MatchVotingSummary,
} from "@/lib/types/view-models";

export interface ValidatedBallotEntry {
  targetPlayerId: string;
  rating: number;
  votedMvp: boolean;
}

export type BallotValidationResult =
  | { ok: true; entries: ValidatedBallotEntry[] }
  | { ok: false; error: string };

export function validateMatchBallot(params: {
  voterPlayerId: string;
  participantIds: ReadonlySet<string>;
  entries: MatchVoteEntryInput[];
}): BallotValidationResult {
  const { voterPlayerId, participantIds, entries } = params;

  if (!participantIds.has(voterPlayerId)) {
    return {
      ok: false,
      error: "Solo los jugadores que disputaron este partido pueden votar.",
    };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      ok: false,
      error: "Debés calificar al menos a un compañero para enviar tu voto.",
    };
  }

  const seenTargets = new Set<string>();
  const normalized: ValidatedBallotEntry[] = [];
  let mvpCount = 0;

  for (const raw of entries) {
    const targetId = typeof raw.targetPlayerId === "string" ? raw.targetPlayerId.trim() : "";
    if (!targetId) {
      return { ok: false, error: "Hay un jugador inválido en la votación." };
    }
    if (targetId === voterPlayerId) {
      return {
        ok: false,
        error: "No podés votarte ni calificarte a vos mismo.",
      };
    }
    if (!participantIds.has(targetId)) {
      return {
        ok: false,
        error: "Solo podés votar a jugadores que participaron en este partido.",
      };
    }
    if (seenTargets.has(targetId)) {
      return {
        ok: false,
        error: "Hay jugadores duplicados en tu planilla de votación.",
      };
    }
    seenTargets.add(targetId);

    const rating = Number(raw.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
      return {
        ok: false,
        error: "Todas las calificaciones deben estar entre 1 y 10.",
      };
    }

    const votedMvp = Boolean(raw.votedMvp);
    if (votedMvp) {
      mvpCount += 1;
    }

    normalized.push({
      targetPlayerId: targetId,
      rating: Math.round(rating * 100) / 100,
      votedMvp,
    });
  }

  if (mvpCount !== 1) {
    return {
      ok: false,
      error:
        mvpCount === 0
          ? "Elegí exactamente un MVP del partido antes de enviar."
          : "Solo podés elegir un MVP por partido.",
    };
  }

  return { ok: true, entries: normalized };
}

export function computeWinningMvpPlayerIds(
  votes: Pick<MatchVote, "targetPlayerId" | "votedMvp">[]
): string[] {
  const mvpCounts = new Map<string, number>();
  for (const vote of votes) {
    if (!vote.votedMvp) continue;
    mvpCounts.set(vote.targetPlayerId, (mvpCounts.get(vote.targetPlayerId) ?? 0) + 1);
  }

  let maxVotes = 0;
  for (const count of mvpCounts.values()) {
    if (count > maxVotes) maxVotes = count;
  }
  if (maxVotes === 0) return [];

  return Array.from(mvpCounts.entries())
    .filter(([, count]) => count === maxVotes)
    .map(([playerId]) => playerId)
    .sort();
}

export function buildMatchVotingSummary(params: {
  matchId: string;
  votingStatus: VotingStatus;
  roster: Pick<MatchLedgerPlayerItem, "playerId" | "displayName" | "team">[];
  votes: MatchVote[];
  viewerPlayerId: string | null;
  isAdmin: boolean;
}): MatchVotingSummary {
  const { matchId, votingStatus, roster, votes, viewerPlayerId, isAdmin } = params;

  const rosterById = new Map(roster.map((p) => [p.playerId, p]));
  const voterSet = new Set(votes.map((v) => v.voterPlayerId));

  const viewerEntries: MatchViewerBallotEntry[] = viewerPlayerId
    ? votes
        .filter((v) => v.voterPlayerId === viewerPlayerId)
        .map((v) => ({
          targetPlayerId: v.targetPlayerId,
          rating: v.rating,
          votedMvp: v.votedMvp,
        }))
        .sort((a, b) => a.targetPlayerId.localeCompare(b.targetPlayerId))
    : [];

  const canViewerVote =
    votingStatus === "open" &&
    viewerPlayerId !== null &&
    rosterById.has(viewerPlayerId);

  const canSeeBreakdown = votingStatus === "closed" || isAdmin;

  if (!canSeeBreakdown) {
    return {
      matchId,
      votingStatus,
      totalVoters: voterSet.size,
      totalParticipants: roster.length,
      hasViewerVoted: viewerEntries.length > 0,
      canViewerVote,
      viewerEntries,
      playerSummaries: [],
      transparentBallots: [],
      winningMvpPlayerIds: [],
    };
  }

  const winningMvpPlayerIds = computeWinningMvpPlayerIds(votes);
  const winningSet = new Set(winningMvpPlayerIds);

  const ratingsByTarget = new Map<string, number[]>();
  const mvpByTarget = new Map<string, number>();

  for (const vote of votes) {
    const arr = ratingsByTarget.get(vote.targetPlayerId) ?? [];
    arr.push(vote.rating);
    ratingsByTarget.set(vote.targetPlayerId, arr);

    if (vote.votedMvp) {
      mvpByTarget.set(
        vote.targetPlayerId,
        (mvpByTarget.get(vote.targetPlayerId) ?? 0) + 1
      );
    }
  }

  const playerSummaries: MatchVotePlayerSummary[] = roster
    .map((player) => {
      const scores = ratingsByTarget.get(player.playerId) ?? [];
      const averageRating =
        scores.length > 0
          ? Math.round(
              (scores.reduce((acc, n) => acc + n, 0) / scores.length) * 100
            ) / 100
          : null;
      const mvpVotes = mvpByTarget.get(player.playerId) ?? 0;
      return {
        playerId: player.playerId,
        displayName: player.displayName,
        team: player.team,
        averageRating,
        ratingsCount: scores.length,
        mvpVotes,
        isTopMvp: winningSet.has(player.playerId),
      };
    })
    .sort((a, b) => {
      if (b.mvpVotes !== a.mvpVotes) return b.mvpVotes - a.mvpVotes;
      const avgA = a.averageRating ?? -1;
      const avgB = b.averageRating ?? -1;
      if (avgB !== avgA) return avgB - avgA;
      return a.displayName.localeCompare(b.displayName);
    });

  const votesByVoter = new Map<string, MatchVote[]>();
  for (const vote of votes) {
    const list = votesByVoter.get(vote.voterPlayerId) ?? [];
    list.push(vote);
    votesByVoter.set(vote.voterPlayerId, list);
  }

  const transparentBallots: MatchTransparentBallot[] = Array.from(
    votesByVoter.entries()
  )
    .map(([voterPlayerId, voterVotes]) => {
      const voterName =
        rosterById.get(voterPlayerId)?.displayName ?? voterPlayerId;
      const mvpEntry = voterVotes.find((v) => v.votedMvp) ?? null;
      const entries = voterVotes
        .map((v) => ({
          targetPlayerId: v.targetPlayerId,
          targetName:
            rosterById.get(v.targetPlayerId)?.displayName ?? v.targetPlayerId,
          rating: v.rating,
          votedMvp: v.votedMvp,
        }))
        .sort((a, b) => {
          if (a.votedMvp !== b.votedMvp) return a.votedMvp ? -1 : 1;
          if (b.rating !== a.rating) return b.rating - a.rating;
          return a.targetName.localeCompare(b.targetName);
        });

      return {
        voterPlayerId,
        voterName,
        mvpTargetId: mvpEntry?.targetPlayerId ?? null,
        mvpTargetName: mvpEntry
          ? (rosterById.get(mvpEntry.targetPlayerId)?.displayName ??
            mvpEntry.targetPlayerId)
          : null,
        entries,
      };
    })
    .sort((a, b) => a.voterName.localeCompare(b.voterName));

  return {
    matchId,
    votingStatus,
    totalVoters: voterSet.size,
    totalParticipants: roster.length,
    hasViewerVoted: viewerEntries.length > 0,
    canViewerVote,
    viewerEntries,
    playerSummaries,
    transparentBallots,
    winningMvpPlayerIds,
  };
}
