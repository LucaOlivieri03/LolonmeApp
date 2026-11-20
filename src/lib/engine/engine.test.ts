import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";
import {
  generateCupBracket,
  resolveCupTieWinner,
  resolveLolonmebolFinalists,
} from "./cup";
import {
  computePairwiseStats,
  computeSubgroupStats,
  computeWilsonConsistency,
} from "./stats";
import {
  computeFundSummary,
  enrollPlayerInSeasonFund,
  resolveDefaultSeasonId,
} from "./fund";
import type {
  CupTie,
  FundMonth,
  FundPayment,
  FundTransaction,
  Match,
  Player,
  PlayerTitle,
  Season,
} from "@/lib/types/domain";

const makePlayer = (id: string, displayName: string): Player => ({
  id,
  displayName,
  role: "player",
  isActive: true,
});

describe("Standings Engine (Reglamento Oficial)", () => {
  it("applies 3/1/0 for league, 4/2/0 for cup teammates, and 0 pts / 0 PJ for cup captains while keeping captain stats", () => {
    const players = [
      makePlayer("p1", "Aguzzi"),
      makePlayer("p2", "Pipo"),
      makePlayer("p3", "Lolo"),
      makePlayer("p4", "Pedro"),
    ];
    const matches: Match[] = [
      {
        id: "m1",
        seasonId: "s26",
        matchNumber: 1,
        matchDate: "2026-02-04",
        matchType: "league",
        modality: "F5",
        teamAScore: 10,
        teamBScore: 7,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          { id: "mp1", matchId: "m1", playerId: "p1", team: "A", isCupCaptain: false, goals: 3, assists: 1, adminRating: 8.5, isMvp: true },
          { id: "mp2", matchId: "m1", playerId: "p2", team: "A", isCupCaptain: false, goals: 2, assists: 0, adminRating: 7.5, isMvp: false },
          { id: "mp3", matchId: "m1", playerId: "p3", team: "B", isCupCaptain: false, goals: 1, assists: 2, adminRating: 6.5, isMvp: false },
          { id: "mp4", matchId: "m1", playerId: "p4", team: "B", isCupCaptain: false, goals: 1, assists: 0, adminRating: 6.0, isMvp: false },
        ],
      },
      {
        id: "m2",
        seasonId: "s26",
        matchNumber: 22,
        matchDate: "2026-07-08",
        matchType: "cup",
        modality: "F5",
        teamAScore: 8,
        teamBScore: 5,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          // p1 is Cup Captain -> 0 pts, 0 PJ in league, but goals/assists/MVP/rating still count!
          { id: "mp5", matchId: "m2", playerId: "p1", team: "A", isCupCaptain: true, goals: 4, assists: 1, adminRating: 9.5, isMvp: true },
          // p3 is teammate on winning cup team -> 4 pts, +1 PJ
          { id: "mp6", matchId: "m2", playerId: "p3", team: "A", isCupCaptain: false, goals: 2, assists: 0, adminRating: 8.0, isMvp: false },
          // p2 is opposing Cup Captain -> 0 pts, 0 PJ
          { id: "mp7", matchId: "m2", playerId: "p2", team: "B", isCupCaptain: true, goals: 2, assists: 0, adminRating: 7.0, isMvp: false },
          // p4 is teammate on losing cup team -> 0 pts, +1 PJ
          { id: "mp8", matchId: "m2", playerId: "p4", team: "B", isCupCaptain: false, goals: 1, assists: 1, adminRating: 6.0, isMvp: false },
        ],
      },
    ];

    const titles: PlayerTitle[] = [
      { id: "t1", playerId: "p1", seasonId: "s25", titleType: "cup", awardedAt: "2025-12-01" },
      { id: "t2", playerId: "p1", seasonId: "s25", titleType: "lolonmebol", awardedAt: "2025-12-20" },
    ];

    const result = computeStandings({ players, matches, titles, seasonId: "s26" });
    const byId = Object.fromEntries(result.rows.map((r) => [r.playerId, r]));

    // p3 won as cup teammate (+4) and lost league (+0) => 4 pts, 2 PJ
    expect(byId.p3.points).toBe(4);
    expect(byId.p3.pj).toBe(2);

    // p1 won league (+3) and was cup captain (+0 pts, +0 PJ) => 3 pts, 1 PJ, 7 goals, 2 MVPs, 2 stars
    expect(byId.p1.points).toBe(3);
    expect(byId.p1.pj).toBe(1);
    expect(byId.p1.goals).toBe(7);
    expect(byId.p1.assists).toBe(2);
    expect(byId.p1.mvps).toBe(2);
    expect(byId.p1.stars).toBe(2);
    expect(byId.p1.avgRating).toBeCloseTo(9.0, 2);

    // p3 is 1st with 4 pts, p1 is 2nd with 3 pts (ahead of p2 via MVPs since both have 3 pts, 1 PJ, 0 H2H, 100% PG%)
    expect(result.rows.map((r) => r.playerId)).toEqual(["p3", "p1", "p2", "p4"]);
    expect(result.needsTitleTiebreaker).toBe(false);
  });

  it("applies exact tiebreaker chain (Pts -> PJ asc -> H2H -> PG% -> MVPs -> Name) and flags 1st/2nd tiebreaker", () => {
    const players = [
      makePlayer("p1", "Alpha"),
      makePlayer("p2", "Beta"),
      makePlayer("p3", "Gamma"),
    ];
    const matches: Match[] = [
      {
        id: "m1",
        seasonId: "s26",
        matchNumber: 1,
        matchDate: "2026-03-01",
        matchType: "league",
        modality: "F5",
        teamAScore: 5,
        teamBScore: 3,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          { id: "a", matchId: "m1", playerId: "p2", team: "A", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
          { id: "b", matchId: "m1", playerId: "p1", team: "B", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
        ],
      },
      {
        id: "m2",
        seasonId: "s26",
        matchNumber: 2,
        matchDate: "2026-03-08",
        matchType: "league",
        modality: "F5",
        teamAScore: 4,
        teamBScore: 1,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          { id: "c", matchId: "m2", playerId: "p1", team: "A", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
          { id: "d", matchId: "m2", playerId: "p3", team: "B", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
        ],
      },
    ];

    const result = computeStandings({ players, matches, titles: [], seasonId: "s26" });
    // p2 has 3 pts in 1 PJ; p1 has 3 pts in 2 PJ -> p2 ranks above p1 via fewer PJ
    expect(result.rows[0].playerId).toBe("p2");
    expect(result.rows[1].playerId).toBe("p1");
    // 1st and 2nd are tied on points -> League title tiebreaker match flagged!
    expect(result.needsTitleTiebreaker).toBe(true);
  });
});

describe("Cup Engine (9 Qualifiers, Quota Release, Preliminary & Overrides)", () => {
  it("qualifies 2 previous LOLONMEBOL finalists + Top 7 with quota release, puts 2 lowest non-finalists in Preliminary", () => {
    // Standings order: p1..p11. Previous LOLONMEBOL finalists: p1 (in top 7) and p10 (outside top 7)
    const standingsIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"];
    const bracket = generateCupBracket({
      editionId: "cup26",
      standingsPlayerIds: standingsIds,
      previousLolonmebolFinalistIds: ["p1", "p10"],
    });

    // Qualifiers: p1, p10 (finalists) + p2, p3, p4, p5, p6, p7, p8 (7 others) = 9 total
    // Lowest 2 non-finalists among qualifiers: p7 and p8 -> Preliminary Round!
    const prelim = bracket.find((t) => t.round === "preliminary");
    expect(prelim?.playerAId).toBe("p7");
    expect(prelim?.playerBId).toBe("p8");

    // Direct 7 to Quarterfinals (ordered by standings): p1, p2, p3, p4, p5, p6, p10
    const qfs = bracket
      .filter((t) => t.round === "quarterfinal")
      .sort((a, b) => a.slotOrder - b.slotOrder);
    expect(qfs).toHaveLength(4);
    expect(qfs[0].playerAId).toBe("p1");
    expect(qfs[0].playerBId).toBeNull(); // vs Winner of Preliminary
    expect(qfs[1].playerAId).toBe("p2");
    expect(qfs[1].playerBId).toBe("p10"); // 2nd vs 7th direct
    expect(qfs[2].playerAId).toBe("p3");
    expect(qfs[2].playerBId).toBe("p6"); // 3rd vs 6th
    expect(qfs[3].playerAId).toBe("p4");
    expect(qfs[3].playerBId).toBe("p5"); // 4th vs 5th
  });

  it("breaks aggregate tie using better seed (ventaja deportiva) and honors manual admin override", () => {
    const tie: CupTie = {
      id: "tie1",
      cupEditionId: "cup26",
      round: "quarterfinal",
      slotOrder: 2,
      playerAId: "p2",
      playerBId: "p7",
      seedA: 2,
      seedB: 7,
      leg1MatchId: null,
      leg2MatchId: null,
      overrideScoreA: 12,
      overrideScoreB: 12,
      winnerPlayerId: null,
    };

    expect(resolveCupTieWinner(tie, [])).toBe("p2");

    const adminOverridden: CupTie = { ...tie, winnerPlayerId: "p7" };
    expect(resolveCupTieWinner(adminOverridden, [])).toBe("p7");
  });

  it("pairs League champion vs League runner-up in Final LOLONMEBOL when same player wins Liga and Copa", () => {
    expect(resolveLolonmebolFinalists("aguzzi", "pedro", "aguzzi")).toEqual([
      "aguzzi",
      "pedro",
    ]);
    expect(resolveLolonmebolFinalists("pipo", "franchini", "aguzzi")).toEqual([
      "pipo",
      "aguzzi",
    ]);
  });
});

describe("Stats Engine (Química, Wilson CT% z=1.28, H2H, Subgroups)", () => {
  it("computes Wilson Consistency (z=1.28), Chemistry %, 3/1/0 Effectiveness, and H2H balance", () => {
    // 10 wins in 10 matches -> Wilson lower bound (z=1.28) ~= 85.91%
    const w10 = computeWilsonConsistency(10, 10);
    expect(w10).toBeCloseTo(85.92, 1);
    expect(computeWilsonConsistency(0, 0)).toBe(0);

    const matches: Match[] = [
      {
        id: "m1",
        seasonId: "s26",
        matchNumber: 1,
        matchDate: "2026-02-04",
        matchType: "league",
        modality: "F5",
        teamAScore: 10,
        teamBScore: 5,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          { id: "1", matchId: "m1", playerId: "p1", team: "A", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
          { id: "2", matchId: "m1", playerId: "p2", team: "A", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
          { id: "3", matchId: "m1", playerId: "p3", team: "B", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
        ],
      },
      {
        id: "m2",
        seasonId: "s26",
        matchNumber: 2,
        matchDate: "2026-02-11",
        matchType: "league",
        modality: "F5",
        teamAScore: 6,
        teamBScore: 6,
        countsForLeague: true,
        countsForStats: true,
        votingStatus: "closed",
        players: [
          { id: "4", matchId: "m2", playerId: "p1", team: "A", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
          { id: "5", matchId: "m2", playerId: "p2", team: "A", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
          { id: "6", matchId: "m2", playerId: "p3", team: "B", isCupCaptain: false, goals: 0, assists: 0, adminRating: null, isMvp: false },
        ],
      },
    ];

    const pair = computePairwiseStats("p1", "p2", matches);
    expect(pair.matchesTogether).toBe(2);
    expect(pair.winsTogether).toBe(1);
    expect(pair.drawsTogether).toBe(1);
    expect(pair.chemistryPct).toBeCloseTo(50, 2);
    // 3/1/0 effectiveness: (3 + 1) / 6 = 66.67%
    expect(pair.effectiveness310Pct).toBeCloseTo(66.67, 1);

    const rivals = computePairwiseStats("p1", "p3", matches);
    expect(rivals.matchesAgainst).toBe(2);
    expect(rivals.h2hBalance).toBe(1); // 1 win, 0 losses, 1 draw

    const subgroup = computeSubgroupStats(["p1", "p2"], matches);
    expect(subgroup.matchesPlayed).toBe(2);
    expect(subgroup.wins).toBe(1);
  });
});

describe("Fund (Pozo) Engine", () => {
  it("computes balance with variable monthly fees, expenses, and yields", () => {
    const months: FundMonth[] = [
      { id: "fm1", seasonId: "s26", monthNumber: 1, monthLabel: "Enero", feeAmount: 2000 },
      { id: "fm2", seasonId: "s26", monthNumber: 2, monthLabel: "Febrero", feeAmount: 3000 },
    ];
    const payments: FundPayment[] = [
      { id: "fp1", fundMonthId: "fm1", playerId: "p1", paid: true },
      { id: "fp2", fundMonthId: "fm1", playerId: "p2", paid: true },
      { id: "fp3", fundMonthId: "fm2", playerId: "p1", paid: true },
      { id: "fp4", fundMonthId: "fm2", playerId: "p2", paid: false },
    ];
    const transactions: FundTransaction[] = [
      { id: "tx1", seasonId: "s26", txType: "yield", amount: 500, description: "Rendimiento MP", txDate: "2026-02-28" },
      { id: "tx2", seasonId: "s26", txType: "expense", amount: 1500, description: "Trofeo", txDate: "2026-02-28" },
    ];

    const summary = computeFundSummary(months, payments, transactions);
    // Collected: 2*2000 + 1*3000 = 7000; - 1500 + 500 = 6000
    expect(summary.totalCollected).toBe(7000);
    expect(summary.totalExpenses).toBe(1500);
    expect(summary.totalYields).toBe(500);
    expect(summary.balance).toBe(6000);
  });

  it("resolves default season dynamically from active/latest season and syncs missing selected IDs", () => {
    const seasons: Season[] = [
      { id: "season-2025", year: 2025, name: "Temporada 2025", status: "finished", cupCutoffDate: "2025-07-01" },
      { id: "season-2027", year: 2027, name: "Temporada 2027", status: "active", cupCutoffDate: "2027-07-01" },
    ];
    expect(resolveDefaultSeasonId(seasons)).toBe("season-2027");
    expect(resolveDefaultSeasonId(seasons, "season-2025")).toBe("season-2025");
    expect(resolveDefaultSeasonId(seasons, "non-existent-id")).toBe("season-2027");
  });

  it("enrolls a player in all fund months of a season without duplicating existing payments", () => {
    const months: FundMonth[] = [
      { id: "fm-2026-1", seasonId: "season-2026", monthNumber: 1, monthLabel: "Enero", feeAmount: 3000 },
      { id: "fm-2026-2", seasonId: "season-2026", monthNumber: 2, monthLabel: "Febrero", feeAmount: 3000 },
    ];
    const existing: FundPayment[] = [
      { id: "fp-fm-2026-1-p1", fundMonthId: "fm-2026-1", playerId: "p1", paid: true },
    ];
    const next = enrollPlayerInSeasonFund(months, existing, "season-2026", "p1");
    expect(next).toHaveLength(2);
    expect(next.find((p) => p.fundMonthId === "fm-2026-1")?.paid).toBe(true);
    expect(next.find((p) => p.fundMonthId === "fm-2026-2")?.paid).toBe(false);
  });
});
