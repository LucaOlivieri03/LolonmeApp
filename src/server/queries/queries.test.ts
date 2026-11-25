import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  computePairwiseStats,
  computeStandings,
  computeSubgroupStats,
  filterMatches,
  getCupTieAggregate,
  resolveCupTieWinner,
} from "@/lib/engine";
import type { TournamentDataset } from "@/lib/types/domain";
import { SeedPublicTournamentRepository } from "@/server/repositories";
import {
  buildCalendarViewModel,
  buildHomeViewModel,
  buildMatchesViewModel,
  buildStatsViewModel,
  loadCalendarViewModel,
  loadHomeViewModel,
  loadMatchesViewModel,
  loadProfileViewModel,
  loadStatsViewModel,
} from "./index";
import { GUEST_SESSION, type ViewerSession } from "@/server/auth";

function loadRealSeedDataset(): TournamentDataset {
  const seedPath = path.resolve(process.cwd(), "src/lib/data/seed-data.json");
  return JSON.parse(fs.readFileSync(seedPath, "utf8")) as TournamentDataset;
}

describe("Server Public Queries — Home & Calendar ViewModels", () => {
  it("buildHomeViewModel matches src/lib/engine computeStandings & cup resolution 100% for 2026 and 2025", async () => {
    const rawDataset = loadRealSeedDataset();
    const repo = new SeedPublicTournamentRepository(rawDataset);

    const vm2026 = await loadHomeViewModel(repo, 2026);
    const expectedAnnual2026 = computeStandings({
      players: rawDataset.players,
      matches: rawDataset.matches,
      titles: rawDataset.titles,
      seasonId: "season-2026",
    });
    const expectedHistorical = computeStandings({
      players: rawDataset.players,
      matches: rawDataset.matches,
      titles: rawDataset.titles,
    });

    expect(vm2026.activeSeason?.year).toBe(2026);
    expect(vm2026.annualStandings).toEqual(expectedAnnual2026);
    expect(vm2026.historicalStandings).toEqual(expectedHistorical);

    const expectedCup2026Ties = rawDataset.cupTies.filter(
      (t) => t.cupEditionId === "cup-2026"
    );
    expect(vm2026.cupTies).toHaveLength(expectedCup2026Ties.length);
    for (const rawTie of expectedCup2026Ties) {
      const resolved = vm2026.cupTies.find((t) => t.id === rawTie.id);
      expect(resolved).toBeDefined();
      const agg = getCupTieAggregate(rawTie, rawDataset.matches);
      const winnerId = resolveCupTieWinner(rawTie, rawDataset.matches);
      expect(resolved!.hasScores).toBe(agg.hasScores);
      expect(resolved!.scoreA).toBe(agg.hasScores ? agg.scoreA : null);
      expect(resolved!.scoreB).toBe(agg.hasScores ? agg.scoreB : null);
      expect(resolved!.isAWin).toBe(
        Boolean(winnerId && winnerId === rawTie.playerAId)
      );
      expect(resolved!.isBWin).toBe(
        Boolean(winnerId && winnerId === rawTie.playerBId)
      );
    }

    const vm2025 = await loadHomeViewModel(repo, 2025);
    const expectedAnnual2025 = computeStandings({
      players: rawDataset.players,
      matches: rawDataset.matches,
      titles: rawDataset.titles,
      seasonId: "season-2025",
    });
    expect(vm2025.activeSeason?.year).toBe(2025);
    expect(vm2025.annualStandings).toEqual(expectedAnnual2025);
  });

  it("HomeViewModel excludes raw matches, raw players, emails, and all fund_* entities", async () => {
    const rawDataset = loadRealSeedDataset();
    rawDataset.players[0] = {
      ...rawDataset.players[0],
      email: "secret-admin@lolonmebol.test",
      userId: "secret-auth-id",
    };

    const repo = new SeedPublicTournamentRepository(rawDataset);
    const vm = await loadHomeViewModel(repo);

    expect("matches" in vm).toBe(false);
    expect("players" in vm).toBe(false);
    expect("fundMonths" in vm).toBe(false);
    expect("fundPayments" in vm).toBe(false);
    expect("fundTransactions" in vm).toBe(false);

    const serialized = JSON.stringify(vm);
    expect(serialized).not.toContain("secret-admin@lolonmebol.test");
    expect(serialized).not.toContain("secret-auth-id");
    expect(serialized).not.toContain("fundMonths");
    expect(serialized).not.toContain("fundPayments");
    expect(serialized).not.toContain("fundTransactions");
  });

  it("loadCalendarViewModel filters by season, groups months descending, and attaches minimal linkedMatch summaries", async () => {
    const rawDataset = loadRealSeedDataset();
    const repo = new SeedPublicTournamentRepository(rawDataset);

    const vm2026 = await loadCalendarViewModel(repo, 2026);
    expect(vm2026.selectedSeasonId).toBe("season-2026");
    expect(vm2026.events.length).toBeGreaterThan(0);
    expect(vm2026.events.every((ev) => ev.seasonId === "season-2026")).toBe(
      true
    );

    // Month groups are strictly descending
    const monthKeys = vm2026.groupedByMonth.map((g) => g.monthKey);
    expect(monthKeys).toEqual([...monthKeys].sort((a, b) => b.localeCompare(a)));

    // Linked match summary contains only 4 display fields, never raw player arrays
    const withMatch = vm2026.events.find((ev) => ev.linkedMatch !== null);
    expect(withMatch).toBeDefined();
    expect(Object.keys(withMatch!.linkedMatch!).sort()).toEqual([
      "matchNumber",
      "modality",
      "teamAScore",
      "teamBScore",
    ]);

    const vmAll = await loadCalendarViewModel(repo, "all");
    expect(vmAll.selectedSeasonId).toBe("ALL");
    expect(vmAll.events.length).toBe(rawDataset.calendarEvents.length);
  });

  it("handles empty dataset gracefully without throwing", () => {
    const emptyData = {
      seasons: [],
      players: [],
      aliases: [],
      titles: [],
      matches: [],
      calendarEvents: [],
      announcements: [],
      cupEditions: [],
      cupTies: [],
    };

    const home = buildHomeViewModel(emptyData);
    expect(home.activeSeason).toBeNull();
    expect(home.annualStandings.rows).toEqual([]);
    expect(home.cupTies).toEqual([]);

    const calendar = buildCalendarViewModel(emptyData);
    expect(calendar.selectedSeasonId).toBe("ALL");
    expect(calendar.events).toEqual([]);
    expect(calendar.groupedByMonth).toEqual([]);

    const matches = buildMatchesViewModel(emptyData);
    expect(matches.selectedSeasonId).toBe("ALL");
    expect(matches.matches).toEqual([]);
    expect(matches.availableMatchNumbers).toEqual([]);

    const stats = buildStatsViewModel(emptyData);
    expect(stats.selectedSeasonId).toBe("ALL");
    expect(stats.activePlayers).toEqual([]);
    expect(stats.lab.subgroup).toBeNull();
    expect(stats.lab.pairwise).toBeNull();
    expect(stats.profile.row).toBeNull();
  });

  it("loadMatchesViewModel matches filterMatches 100% across filters and excludes sensitive fields", async () => {
    const rawDataset = loadRealSeedDataset();
    rawDataset.players[0] = {
      ...rawDataset.players[0],
      email: "secret-match@lolonmebol.test",
      userId: "secret-match-uid",
    };
    const repo = new SeedPublicTournamentRepository(rawDataset);

    const vmDefault = await loadMatchesViewModel(repo);
    const expected2026 = filterMatches(rawDataset.matches, {
      seasonId: "season-2026",
      matchType: "ALL",
      dateFilter: "",
      matchNumberQuery: "",
      playerId: "ALL",
    });
    expect(vmDefault.selectedSeasonId).toBe("season-2026");
    expect(vmDefault.matches.map((m) => m.id)).toEqual(
      expected2026.map((m) => m.id)
    );
    expect(vmDefault.availableMatchNumbers).toEqual(
      [...vmDefault.availableMatchNumbers].sort((a, b) => a - b)
    );

    const targetPlayerId = rawDataset.players[0].id;
    const vmFiltered = await loadMatchesViewModel(repo, {
      seasonFilter: "all",
      matchType: "league",
      playerId: targetPlayerId,
    });
    const expectedFiltered = filterMatches(rawDataset.matches, {
      seasonId: "ALL",
      matchType: "league",
      dateFilter: "",
      matchNumberQuery: "",
      playerId: targetPlayerId,
    });
    expect(vmFiltered.selectedSeasonId).toBe("ALL");
    expect(vmFiltered.matches.map((m) => m.id)).toEqual(
      expectedFiltered.map((m) => m.id)
    );

    const serialized = JSON.stringify(vmDefault);
    expect(serialized).not.toContain("secret-match@lolonmebol.test");
    expect(serialized).not.toContain("secret-match-uid");
    expect(serialized).not.toContain("fundMonths");
    expect(serialized).not.toContain("fundPayments");
    expect(serialized).not.toContain("fundTransactions");
  });

  it("loadStatsViewModel matches src/lib/engine standings, subgroup, and pairwise stats 100% without leaking raw matches", async () => {
    const rawDataset = loadRealSeedDataset();
    rawDataset.players[0] = {
      ...rawDataset.players[0],
      email: "secret-stats@lolonmebol.test",
      userId: "secret-stats-uid",
    };
    const repo = new SeedPublicTournamentRepository(rawDataset);

    const historical = computeStandings({
      players: rawDataset.players,
      matches: rawDataset.matches,
      titles: rawDataset.titles,
    });
    const activeRows = historical.rows.filter((r) => r.totalPjAllMatches >= 3);
    const [p1, p2, p3] = activeRows;

    const vmDefault = await loadStatsViewModel(repo);
    expect(vmDefault.selectedSeasonId).toBe("ALL");
    expect(vmDefault.selectedModality).toBe("ALL");
    expect(vmDefault.activePlayers).toHaveLength(activeRows.length);
    expect(vmDefault.lab.selectedPlayerIds).toEqual([p1.playerId, p2.playerId]);
    expect(vmDefault.lab.subgroup).toEqual(
      computeSubgroupStats([p1.playerId, p2.playerId], rawDataset.matches, {
        modality: "ALL",
      })
    );
    expect(vmDefault.lab.pairwise?.stats).toEqual(
      computePairwiseStats(p1.playerId, p2.playerId, rawDataset.matches, {
        modality: "ALL",
      })
    );
    expect(vmDefault.profile.selectedPlayerId).toBe(p1.playerId);
    expect(vmDefault.profile.row).toEqual(p1);

    // 3-player subgroup computes subgroup stats and sets pairwise to null
    const vmTrio = await loadStatsViewModel(repo, {
      seasonFilter: 2026,
      modality: "F5",
      labPlayerIds: [p1.playerId, p2.playerId, p3.playerId],
      playerId: p2.playerId,
    });
    expect(vmTrio.selectedSeasonId).toBe("season-2026");
    expect(vmTrio.selectedModality).toBe("F5");
    expect(vmTrio.lab.pairwise).toBeNull();
    expect(vmTrio.lab.subgroup).toEqual(
      computeSubgroupStats(
        [p1.playerId, p2.playerId, p3.playerId],
        rawDataset.matches,
        { seasonId: "season-2026", modality: "F5" }
      )
    );
    expect(vmTrio.profile.selectedPlayerId).toBe(p2.playerId);

    // Explicit clear (`[]`) returns empty lab selection without falling back to default 2 players
    const vmCleared = await loadStatsViewModel(repo, { labPlayerIds: [] });
    expect(vmCleared.lab.selectedPlayerIds).toEqual([]);
    expect(vmCleared.lab.subgroup).toBeNull();
    expect(vmCleared.lab.pairwise).toBeNull();

    // No raw matches, no emails, no fund_*
    expect("matches" in vmDefault).toBe(false);
    expect("players" in vmDefault).toBe(false);
    const serialized = JSON.stringify(vmDefault);
    expect(serialized).not.toContain("secret-stats@lolonmebol.test");
    expect(serialized).not.toContain("secret-stats-uid");
    expect(serialized).not.toContain("fundMonths");
    expect(serialized).not.toContain("fundPayments");
    expect(serialized).not.toContain("fundTransactions");
  });
});

describe("RSC architectural contract for /, /calendario, /reglas, /blog, /partidos, /stats", () => {
  const publicRscPages = [
    "src/app/page.tsx",
    "src/app/calendario/page.tsx",
    "src/app/reglas/page.tsx",
    "src/app/blog/page.tsx",
    "src/app/partidos/page.tsx",
    "src/app/stats/page.tsx",
    "src/app/perfil/page.tsx",
  ];

  it('keeps public pages as React Server Components without "use client", useTournament, or client engine calls', () => {
    for (const relPath of publicRscPages) {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), relPath),
        "utf8"
      );
      expect(content, `${relPath} must not have "use client"`).not.toMatch(
        /^\s*["']use client["']/m
      );
      expect(content, `${relPath} must not import useTournament`).not.toContain(
        "useTournament"
      );
      expect(
        content,
        `${relPath} must not call computeStandings directly`
      ).not.toContain("computeStandings");
      expect(
        content,
        `${relPath} must not import recharts`
      ).not.toContain("recharts");
    }
  });

  it("keeps /partidos and /stats client islands free of useTournament, engine computations, and eager recharts imports", () => {
    const matchesIsland = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/components/matches/PartidosInteractiveView.tsx"
      ),
      "utf8"
    );
    expect(matchesIsland).not.toContain("useTournament");
    expect(matchesIsland).not.toContain("@/lib/engine");

    const statsIsland = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/components/stats/StatsInteractiveView.tsx"
      ),
      "utf8"
    );
    expect(statsIsland).not.toContain("useTournament");
    expect(statsIsland).not.toContain("@/lib/engine");
    expect(statsIsland).not.toMatch(/from\s+["']recharts["']/);
    expect(statsIsland).toContain("next/dynamic");

    const loginCard = fs.readFileSync(
      path.resolve(process.cwd(), "src/components/profile/LoginCard.tsx"),
      "utf8"
    );
    expect(loginCard).not.toContain("useTournament");
    expect(loginCard).not.toContain("localStorage");
    expect(loginCard).not.toContain("@/lib/engine");
  });
});

describe("Server Profile Query — guest, unlinked, and linked states", () => {
  it("returns minimal guest and unlinked view models without querying tournament dataset", async () => {
    const repo = new SeedPublicTournamentRepository(loadRealSeedDataset());
    const datasetSpy = vi.spyOn(repo, "getPublicDataset");

    const guestVm = await loadProfileViewModel(GUEST_SESSION, repo, {
      isAuthConfigured: true,
    });
    expect(guestVm).toEqual({
      status: "guest",
      isAuthConfigured: true,
    });
    expect(datasetSpy).not.toHaveBeenCalled();

    const unlinkedSession: ViewerSession = {
      role: "guest",
      userId: "auth-u1",
      playerId: null,
      playerUuid: null,
      displayName: null,
      email: "nuevo@lolonmebol.test",
    };
    const unlinkedVm = await loadProfileViewModel(unlinkedSession, repo);
    expect(unlinkedVm).toEqual({
      status: "unlinked",
      email: "nuevo@lolonmebol.test",
    });
    expect(datasetSpy).not.toHaveBeenCalled();
  });

  it("computes personal standings, stars, and up to 6 recent matches for a linked player without leaking other emails or fund_*", async () => {
    const rawDataset = loadRealSeedDataset();
    const targetPlayer = rawDataset.players[0];
    rawDataset.players[1] = {
      ...rawDataset.players[1],
      email: "other-player-secret@lolonmebol.test",
    };

    const repo = new SeedPublicTournamentRepository(rawDataset);
    const linkedSession: ViewerSession = {
      role: "player",
      userId: "auth-linked-1",
      playerId: targetPlayer.id,
      playerUuid: "uuid-linked-1",
      displayName: targetPlayer.displayName,
      email: "me@lolonmebol.test",
    };

    const vm = await loadProfileViewModel(linkedSession, repo);
    expect(vm.status).toBe("linked");
    if (vm.status !== "linked") return;

    const expectedAnnual = computeStandings({
      players: rawDataset.players,
      matches: rawDataset.matches,
      titles: rawDataset.titles,
      seasonId: "season-2026",
    }).rows.find((r) => r.playerId === targetPlayer.id) ?? null;

    const expectedHistorical = computeStandings({
      players: rawDataset.players,
      matches: rawDataset.matches,
      titles: rawDataset.titles,
    }).rows.find((r) => r.playerId === targetPlayer.id) ?? null;

    expect(vm.player).toMatchObject({
      id: targetPlayer.id,
      displayName: targetPlayer.displayName,
      role: "player",
      email: "me@lolonmebol.test",
    });
    expect(vm.annualRow).toEqual(expectedAnnual);
    expect(vm.historicalRow).toEqual(expectedHistorical);
    expect(vm.recentMatches.length).toBeLessThanOrEqual(6);

    const serialized = JSON.stringify(vm);
    expect(serialized).not.toContain("other-player-secret@lolonmebol.test");
    expect(serialized).not.toContain("fundMonths");
    expect(serialized).not.toContain("fundPayments");
    expect(serialized).not.toContain("fundTransactions");
  });
});
