import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  computeStandings,
  getCupTieAggregate,
  resolveCupTieWinner,
} from "@/lib/engine";
import type { TournamentDataset } from "@/lib/types/domain";
import { SeedPublicTournamentRepository } from "@/server/repositories";
import {
  buildCalendarViewModel,
  buildHomeViewModel,
  loadCalendarViewModel,
  loadHomeViewModel,
} from "./index";

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
  });
});

describe("RSC architectural contract for /, /calendario, /reglas, /blog", () => {
  const publicRscPages = [
    "src/app/page.tsx",
    "src/app/calendario/page.tsx",
    "src/app/reglas/page.tsx",
    "src/app/blog/page.tsx",
  ];

  it('keeps public pages as React Server Components without "use client", useTournament, or computeStandings', () => {
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
    }
  });
});
