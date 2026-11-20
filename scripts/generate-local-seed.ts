import fs from "fs";
import path from "path";
import { parseLolonmebolWorkbookFile } from "../src/lib/excel";
import { computeStandings, generateCupBracket } from "../src/lib/engine";

async function main() {
  const xlsxPath = path.resolve(process.cwd(), "docs/LOLONMEBOL.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    console.error(`Excel file not found at ${xlsxPath}`);
    process.exit(1);
  }

  const dataset = await parseLolonmebolWorkbookFile(xlsxPath);

  // Auto-generate initial Cup 2026 bracket from 2026 standings + 2025 LOLONMEBOL finalists (B. Aguzzi, Pipo)
  const s26 = dataset.seasons.find((s) => s.year === 2026);
  if (s26) {
    const standings26 = computeStandings({
      players: dataset.players,
      matches: dataset.matches,
      titles: dataset.titles,
      seasonId: s26.id,
    });
    const edition26 = dataset.cupEditions.find((e) => e.seasonId === s26.id);
    if (edition26) {
      edition26.cutoffSnapshotPlayerIds = standings26.rows.map(
        (r) => r.playerId
      );
      const ties26 = generateCupBracket({
        editionId: edition26.id,
        standingsPlayerIds: edition26.cutoffSnapshotPlayerIds,
        previousLolonmebolFinalistIds: ["b-aguzzi", "pipo"],
      });
      dataset.cupTies.push(...ties26);
    }
  }

  const outDir = path.resolve(process.cwd(), "src/lib/data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "seed-data.json");
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), "utf8");

  console.log(
    `Generated ${outPath}: ${dataset.seasons.length} seasons, ${dataset.players.length} players, ${dataset.matches.length} matches, ${dataset.fundMonths.length} fund months.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
