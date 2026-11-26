import { describe, expect, it } from "vitest";
import {
  buildMatchVotingSummary,
  computeWinningMvpPlayerIds,
  validateMatchBallot,
} from "./engine";
import type { MatchVote } from "@/lib/types/domain";

const ROSTER = [
  { playerId: "p1", displayName: "Luca", team: "A" as const },
  { playerId: "p2", displayName: "Nico", team: "A" as const },
  { playerId: "p3", displayName: "Santi", team: "B" as const },
  { playerId: "p4", displayName: "Tomi", team: "B" as const },
];

const PARTICIPANTS = new Set(ROSTER.map((p) => p.playerId));

describe("validateMatchBallot", () => {
  it("rejects voters who did not play in the match", () => {
    const res = validateMatchBallot({
      voterPlayerId: "outsider",
      participantIds: PARTICIPANTS,
      entries: [{ targetPlayerId: "p2", rating: 8, votedMvp: true }],
    });
    expect(res.ok).toBe(false);
  });

  it("rejects self-voting", () => {
    const res = validateMatchBallot({
      voterPlayerId: "p1",
      participantIds: PARTICIPANTS,
      entries: [
        { targetPlayerId: "p1", rating: 10, votedMvp: true },
        { targetPlayerId: "p2", rating: 7, votedMvp: false },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("vos mismo");
  });

  it("requires exactly one MVP vote", () => {
    const noMvp = validateMatchBallot({
      voterPlayerId: "p1",
      participantIds: PARTICIPANTS,
      entries: [{ targetPlayerId: "p2", rating: 8, votedMvp: false }],
    });
    expect(noMvp.ok).toBe(false);

    const twoMvps = validateMatchBallot({
      voterPlayerId: "p1",
      participantIds: PARTICIPANTS,
      entries: [
        { targetPlayerId: "p2", rating: 8, votedMvp: true },
        { targetPlayerId: "p3", rating: 9, votedMvp: true },
      ],
    });
    expect(twoMvps.ok).toBe(false);
  });

  it("rejects out-of-range ratings and duplicate targets", () => {
    const outOfRange = validateMatchBallot({
      voterPlayerId: "p1",
      participantIds: PARTICIPANTS,
      entries: [{ targetPlayerId: "p2", rating: 11, votedMvp: true }],
    });
    expect(outOfRange.ok).toBe(false);

    const duplicate = validateMatchBallot({
      voterPlayerId: "p1",
      participantIds: PARTICIPANTS,
      entries: [
        { targetPlayerId: "p2", rating: 7, votedMvp: true },
        { targetPlayerId: "p2", rating: 8, votedMvp: false },
      ],
    });
    expect(duplicate.ok).toBe(false);
  });

  it("accepts a valid ballot and rounds ratings to 2 decimals", () => {
    const res = validateMatchBallot({
      voterPlayerId: "p1",
      participantIds: PARTICIPANTS,
      entries: [
        { targetPlayerId: "p2", rating: 8.5, votedMvp: true },
        { targetPlayerId: "p3", rating: 6.333, votedMvp: false },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entries).toEqual([
        { targetPlayerId: "p2", rating: 8.5, votedMvp: true },
        { targetPlayerId: "p3", rating: 6.33, votedMvp: false },
      ]);
    }
  });
});

describe("buildMatchVotingSummary & computeWinningMvpPlayerIds", () => {
  const sampleVotes: MatchVote[] = [
    {
      id: "v1",
      matchId: "m1",
      voterPlayerId: "p1",
      targetPlayerId: "p2",
      rating: 9,
      votedMvp: true,
    },
    {
      id: "v2",
      matchId: "m1",
      voterPlayerId: "p1",
      targetPlayerId: "p3",
      rating: 7,
      votedMvp: false,
    },
    {
      id: "v3",
      matchId: "m1",
      voterPlayerId: "p3",
      targetPlayerId: "p2",
      rating: 8,
      votedMvp: true,
    },
    {
      id: "v4",
      matchId: "m1",
      voterPlayerId: "p3",
      targetPlayerId: "p1",
      rating: 7.5,
      votedMvp: false,
    },
  ];

  it("hides breakdown from regular participants while voting is open, but shows own entries", () => {
    const summary = buildMatchVotingSummary({
      matchId: "m1",
      votingStatus: "open",
      roster: ROSTER,
      votes: sampleVotes,
      viewerPlayerId: "p1",
      isAdmin: false,
    });

    expect(summary.canViewerVote).toBe(true);
    expect(summary.hasViewerVoted).toBe(true);
    expect(summary.totalVoters).toBe(2);
    expect(summary.viewerEntries).toHaveLength(2);
    expect(summary.playerSummaries).toEqual([]);
    expect(summary.transparentBallots).toEqual([]);
    expect(summary.winningMvpPlayerIds).toEqual([]);
  });

  it("exposes full transparent breakdown, averages, and winning MVP once closed", () => {
    const summary = buildMatchVotingSummary({
      matchId: "m1",
      votingStatus: "closed",
      roster: ROSTER,
      votes: sampleVotes,
      viewerPlayerId: null,
      isAdmin: false,
    });

    expect(summary.canViewerVote).toBe(false);
    expect(summary.winningMvpPlayerIds).toEqual(["p2"]);
    expect(summary.playerSummaries[0]).toMatchObject({
      playerId: "p2",
      displayName: "Nico",
      averageRating: 8.5,
      ratingsCount: 2,
      mvpVotes: 2,
      isTopMvp: true,
    });
    expect(summary.transparentBallots).toHaveLength(2);
    expect(summary.transparentBallots[0]?.voterName).toBe("Luca");
    expect(summary.transparentBallots[0]?.mvpTargetName).toBe("Nico");
  });

  it("handles MVP ties cleanly", () => {
    const winners = computeWinningMvpPlayerIds([
      { targetPlayerId: "p2", votedMvp: true },
      { targetPlayerId: "p3", votedMvp: true },
    ]);
    expect(winners).toEqual(["p2", "p3"]);
  });
});
