import { describe, expect, it } from "vitest";
import path from "path";
import fs from "fs";
import { normalizePlayerName, parseCupCaptainCell, parseSpanishDate } from "./normalize";
import { parseLolonmebolWorkbookFile } from "./parser";
import { computeImportDiff, applyImportDiff } from "./diff";
import { computeFundSummary, computePairwiseStats, computeStandings } from "@/lib/engine";

describe("Excel Normalizer", () => {
  it("strips star emojis, captain markers, and extra whitespace", () => {
    expect(normalizePlayerName("B. Aguzzi ⭐⭐⭐")).toEqual({
      canonicalName: "B. Aguzzi",
      starsCount: 3,
      isCaptain: false,
      note: null,
    });
    expect(normalizePlayerName("Pipo ⭐️ (c)")).toEqual({
      canonicalName: "Pipo",
      starsCount: 1,
      isCaptain: true,
      note: null,
    });
    expect(normalizePlayerName("Scaffo (asador)")).toEqual({
      canonicalName: "Scaffo",
      starsCount: 0,
      isCaptain: false,
      note: "asador",
    });
  });

  it("parses cup captain cells with scores and aggregates", () => {
    expect(parseCupCaptainCell("Pipo ⭐ 5 (5)")).toEqual({
      canonicalName: "Pipo",
      score: 5,
      aggregate: 5,
    });
    expect(parseCupCaptainCell("B. Aguzzi ⭐⭐⭐ 9 (9)")).toEqual({
      canonicalName: "B. Aguzzi",
      score: 9,
      aggregate: 9,
    });
  });

  it("parses Spanish dates into YYYY-MM-DD, rejects impossible calendar dates, and avoids UTC shift", () => {
    expect(parseSpanishDate("4 de febrero", 2026)).toBe("2026-02-04");
    expect(parseSpanishDate("30 de enero", 2025)).toBe("2025-01-30");
    expect(parseSpanishDate("2026-10-09", 2026)).toBe("2026-10-09");
    expect(parseSpanishDate("29 de febrero de 2024", 2024)).toBe("2024-02-29");

    // Impossible calendar dates fall back instead of rolling over or emitting invalid ISO strings
    expect(parseSpanishDate("31 de febrero", 2026)).toBe("2026-01-01");
    expect(parseSpanishDate("29 de febrero", 2026)).toBe("2026-01-01");
    expect(parseSpanishDate("31 de abril", 2026)).toBe("2026-01-01");
    expect(parseSpanishDate("2026-02-31", 2026)).toBe("2026-01-01");

    // Late-evening Argentina timestamps do not shift to next UTC day
    expect(
      parseSpanishDate(
        "Tue Jul 28 2026 21:00:00 GMT-0300 (Argentina Standard Time)",
        2026
      )
    ).toBe("2026-07-28");
  });
});

describe("Excel Importer & Real LOLONMEBOL.xlsx Cross-Check", () => {
  const xlsxPath = path.resolve(process.cwd(), "docs/LOLONMEBOL.xlsx");
  const hasRealFile = fs.existsSync(xlsxPath);

  it.skipIf(!hasRealFile)(
    "parses docs/LOLONMEBOL.xlsx and computes standings matching official 2026 & 2025 sheets",
    async () => {
      const dataset = await parseLolonmebolWorkbookFile(xlsxPath);

      expect(dataset.seasons.map((s) => s.year).sort()).toEqual([2025, 2026]);
      expect(dataset.players.length).toBeGreaterThanOrEqual(15);
      expect(dataset.matches.length).toBeGreaterThanOrEqual(70);

      // Ensure non-player headers/subtotals like Total, Rendimientos, and Gastos are excluded
      const playerIds = dataset.players.map((p) => p.id);
      expect(playerIds).not.toContain("total");
      expect(playerIds).not.toContain("rendimientos");
      expect(playerIds).not.toContain("gastos");
      expect(
        dataset.fundPayments.some(
          (fp) =>
            fp.playerId === "total" ||
            fp.playerId === "rendimientos" ||
            fp.playerId === "gastos"
        )
      ).toBe(false);

      // Verify 2026 leader is B. Aguzzi with 69 pts and 34 PJ (from Liga 26 y Copa 26)
      const s26 = dataset.seasons.find((s) => s.year === 2026)!;
      const standings26 = computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
        seasonId: s26.id,
      });

      expect(standings26.rows[0].displayName).toBe("B. Aguzzi");
      expect(standings26.rows[0].points).toBe(69);
      expect(standings26.rows[0].pj).toBe(34);
      expect(standings26.rows[0].goals).toBeGreaterThanOrEqual(70);

      // Verify 2025 leader is Pipo with 77 pts and 37 PJ (from Liga 25 y Copa 25)
      const s25 = dataset.seasons.find((s) => s.year === 2025)!;
      const standings25 = computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
        seasonId: s25.id,
      });

      expect(standings25.rows[0].displayName).toBe("Pipo");
      expect(standings25.rows[0].points).toBe(77);
      expect(standings25.rows[0].pj).toBe(37);

      // Verify Pozo y premios 26 parses column-based Gastos & Rendimientos accurately (balance = 144735.91)
      const f26Months = dataset.fundMonths.filter((m) => m.seasonId === s26.id);
      const f26MonthIds = new Set(f26Months.map((m) => m.id));
      const f26Payments = dataset.fundPayments.filter((p) => f26MonthIds.has(p.fundMonthId));
      const f26Txs = dataset.fundTransactions.filter((t) => t.seasonId === s26.id);
      const fund26 = computeFundSummary(f26Months, f26Payments, f26Txs);
      expect(fund26.totalCollected).toBe(219000);
      expect(fund26.totalExpenses).toBe(77120);
      expect(fund26.totalYields).toBeCloseTo(2855.91, 2);
      expect(fund26.balance).toBeCloseTo(144735.91, 2);

      // Verify F11 sub-headers are preserved per match (Aniversario 2 vs Oktubre) and friendly F11s do not pollute 2026 stats/standings
      const f11Matches26 = dataset.matches.filter(
        (m) => m.seasonId === s26.id && m.matchType === "special_f11"
      );
      expect(f11Matches26.map((m) => m.notes).sort()).toEqual([
        "F11 Aniversario 2",
        "F11 Oktubre",
      ]);
      expect(f11Matches26.every((m) => m.countsForStats === false)).toBe(true);
      expect(standings26.rows).toHaveLength(27);

      const aguzziFausto26 = computePairwiseStats("b-aguzzi", "fausto", dataset.matches, {
        seasonId: s26.id,
      });
      expect(aguzziFausto26.matchesTogether).toBe(12);
      expect(aguzziFausto26.winsTogether).toBe(8);
      expect(aguzziFausto26.chemistryPct).toBeCloseTo(66.67, 1);
      expect(aguzziFausto26.wilsonCtPct).toBeCloseTo(48.2, 1);
      expect(aguzziFausto26.h2hBalance).toBe(7);

      // Verify Rendimientos 26 Calificaciones totals match Excel ground truth
      const aguzzi26 = standings26.rows.find((r) => r.playerId === "b-aguzzi")!;
      const joaco26 = standings26.rows.find((r) => r.playerId === "joaco")!;
      expect(aguzzi26.totalRating).toBeCloseTo(288.5, 2);
      expect(joaco26.totalRating).toBeCloseTo(245, 2);

      // Verify Copa 25 & Copa 26 brackets are parsed from Liga/Copa sheets without leaking placeholders
      expect(playerIds).not.toContain("g2-g3");
      const cup25Ties = dataset.cupTies.filter((t) => t.cupEditionId === "cup-2025");
      const cup26Ties = dataset.cupTies.filter((t) => t.cupEditionId === "cup-2026");
      expect(cup25Ties).toHaveLength(7);
      expect(cup25Ties.find((t) => t.round === "final")?.winnerPlayerId).toBe("b-aguzzi");
      expect(cup26Ties).toHaveLength(8);
      const cup26Prelim = cup26Ties.find((t) => t.round === "preliminary")!;
      expect(cup26Prelim.playerAId).toBe("pipo");
      expect(cup26Prelim.playerBId).toBe("gero");
      expect(cup26Prelim.winnerPlayerId).toBe("pipo");
      expect(cup26Prelim.leg1MatchId).toBeTruthy();
      expect(cup26Prelim.leg2MatchId).toBeTruthy();

      // Verify Dry-Run Diff detects 0 changes on identical re-import and 1 update when a score changes
      const sameDiff = computeImportDiff(dataset, dataset);
      expect(sameDiff.newMatches).toHaveLength(0);
      expect(sameDiff.updatedMatches).toHaveLength(0);
      expect(sameDiff.unchangedMatchesCount).toBe(dataset.matches.length);

      const modified = structuredClone(dataset);
      modified.matches[0].teamAScore = (modified.matches[0].teamAScore ?? 0) + 1;
      const changedDiff = computeImportDiff(dataset, modified);
      expect(changedDiff.updatedMatches).toHaveLength(1);

      const merged = applyImportDiff(dataset, modified, { overwriteExisting: true });
      expect(merged.matches[0].teamAScore).toBe(modified.matches[0].teamAScore);

      // Verify importer diff & merge updates Pozo, Copa ties, match notes/countsForStats, and purges legacy "total" noise
      const staleExisting = structuredClone(dataset);
      staleExisting.players.push({
        id: "total",
        displayName: "Total",
        role: "player",
        isActive: true,
      });
      staleExisting.fundTransactions = [];
      staleExisting.cupTies = [];
      const staleF11 = staleExisting.matches.find((m) => m.notes === "F11 Oktubre")!;
      staleF11.notes = "F11 Aniversario 2";
      staleF11.countsForStats = true;

      const staleDiff = computeImportDiff(staleExisting, dataset);
      expect(staleDiff.updatedMatches.length).toBeGreaterThanOrEqual(1);

      const repaired = applyImportDiff(staleExisting, dataset, {
        overwriteExisting: true,
      });
      expect(repaired.players.map((p) => p.id)).not.toContain("total");
      expect(repaired.fundTransactions.length).toBe(dataset.fundTransactions.length);
      expect(repaired.cupTies.length).toBe(dataset.cupTies.length);
      const repairedF11 = repaired.matches.find((m) => m.id === staleF11.id)!;
      expect(repairedF11.notes).toBe("F11 Oktubre");
      expect(repairedF11.countsForStats).toBe(false);
    },
    15_000
  );
});
