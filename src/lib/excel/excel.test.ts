import { describe, expect, it } from "vitest";
import path from "path";
import fs from "fs";
import { normalizePlayerName, parseCupCaptainCell, parseSpanishDate } from "./normalize";
import { parseLolonmebolWorkbookFile } from "./parser";
import { computeImportDiff, applyImportDiff } from "./diff";
import { computeStandings } from "@/lib/engine";

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

  it("parses Spanish dates into YYYY-MM-DD", () => {
    expect(parseSpanishDate("4 de febrero", 2026)).toBe("2026-02-04");
    expect(parseSpanishDate("30 de enero", 2025)).toBe("2025-01-30");
    expect(parseSpanishDate("2026-10-09", 2026)).toBe("2026-10-09");
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
    }
  );
});
