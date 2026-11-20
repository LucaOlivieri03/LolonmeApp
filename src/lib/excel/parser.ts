import ExcelJS from "exceljs";
import type {
  Announcement,
  CalendarEvent,
  CupEdition,
  CupTie,
  FundMonth,
  FundPayment,
  FundTransaction,
  Match,
  MatchModality,
  MatchPlayer,
  MatchType,
  Player,
  PlayerAlias,
  PlayerTitle,
  Season,
  TournamentDataset,
} from "@/lib/types/domain";
import {
  normalizePlayerName,
  parseCupCaptainCell,
  parseSpanishDate,
  playerSlug,
} from "./normalize";

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) {
      const r = v.result;
      if (r === null || r === undefined) return "";
      if (r instanceof Date) return r.toISOString().slice(0, 10);
      if (typeof r === "object") return "";
      return String(r).trim();
    }
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((x) => x.text).join("").trim();
    }
    return "";
  }
  return String(v).trim();
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const txt = cellText(cell);
  if (!txt) return null;
  const n = Number(txt.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inferModality(teamASize: number, teamBSize: number, matchType: MatchType): MatchModality {
  if (matchType === "special_f11") return "F11";
  const maxTeam = Math.max(teamASize, teamBSize);
  if (maxTeam >= 9) return "F11";
  if (maxTeam === 7) return "F7";
  if (maxTeam === 6) return "F6";
  return "F5";
}

function isIntegerString(s: string): boolean {
  return /^\d+$/.test(s.trim());
}

function isMatchHeader(col1: string, col2: string): { matchNumber: number; label: string } | null {
  const c1 = col1.trim();
  if (!c1) return null;

  // Simple integer match number (e.g. "1", "22", "45")
  if (isIntegerString(c1)) {
    // Make sure col2 looks like a date (not another score integer!)
    if (col2 && !isIntegerString(col2)) {
      return { matchNumber: Number(c1), label: c1 };
    }
    return null;
  }

  // Cup match header (e.g. "22: Fase Previa - ida", "27: Cuartos - Ida")
  const cupHeader = c1.match(/^(\d+)\s*:\s*(.+)$/);
  if (cupHeader) {
    return { matchNumber: Number(cupHeader[1]), label: cupHeader[2].trim() };
  }

  return null;
}

class PlayerRegistry {
  players = new Map<string, Player>();
  aliases = new Map<string, PlayerAlias>();
  starsSeen = new Map<string, number>();

  getOrCreate(rawName: string): { playerId: string; isCaptain: boolean; note: string | null } | null {
    const trimmed = rawName.trim();
    if (!trimmed) return null;

    const norm = normalizePlayerName(trimmed);
    if (!norm.canonicalName) return null;

    // Filter out non-player header/score/summary noise
    if (isIntegerString(norm.canonicalName)) return null;
    if (
      /^(f11|liga|copa|lolonmebol|descanso|partido|mvp|total|totales|subtotal|subtotales|rendimiento|rendimientos|gasto|gastos|premio|premios|saldo|pozo|cuota|cuotas|mes|jugador|jugadores|promedio|calificaciones)/i.test(
        norm.canonicalName
      )
    ) {
      return null;
    }

    const id = playerSlug(norm.canonicalName);
    if (!id) return null;

    if (!this.players.has(id)) {
      this.players.set(id, {
        id,
        displayName: norm.canonicalName,
        role: "player",
        isActive: true,
      });
    }

    if (norm.starsCount > (this.starsSeen.get(id) ?? 0)) {
      this.starsSeen.set(id, norm.starsCount);
    }

    if (!this.aliases.has(trimmed)) {
      this.aliases.set(trimmed, {
        id: `alias-${this.aliases.size + 1}`,
        playerId: id,
        rawName: trimmed,
      });
    }

    return { playerId: id, isCaptain: norm.isCaptain, note: norm.note };
  }
}

interface ColumnPairSpec {
  colA: number;
  colB: number;
  matchType: MatchType;
  isDrawColumn: boolean;
  countsForLeague: boolean;
}

function parseFechasSheet(
  ws: ExcelJS.Worksheet,
  season: Season,
  registry: PlayerRegistry,
  calendarEvents: CalendarEvent[]
): Match[] {
  const matches: Match[] = [];
  const headerRow = ws.getRow(1);
  const colSpecs: ColumnPairSpec[] = [];
  let mvpColStart = -1;
  let restCol = -1;

  // Detect column blocks from row 1 headers
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = cellText(headerRow.getCell(c)).toLowerCase();
    if (!h) continue;

    if (h.startsWith("mvp") && mvpColStart === -1) {
      mvpColStart = c;
      continue;
    }
    if (h.includes("descanso") && restCol === -1) {
      restCol = c;
      continue;
    }

    // Only process left column of each 2-column pair
    const prevH = c > 1 ? cellText(headerRow.getCell(c - 1)).toLowerCase() : "";
    if (h === prevH) continue;

    if (h.includes("f11")) {
      colSpecs.push({
        colA: c,
        colB: c + 1,
        matchType: "special_f11",
        isDrawColumn: false,
        countsForLeague: season.year === 2025, // Historical exception: F11 Aniversario 2025 counts for League
      });
    } else if (h.includes("lolonmebol")) {
      colSpecs.push({
        colA: c,
        colB: c + 1,
        matchType: "lolonmebol",
        isDrawColumn: false,
        countsForLeague: false,
      });
    } else if (h.includes("copa")) {
      colSpecs.push({
        colA: c,
        colB: c + 1,
        matchType: "cup",
        isDrawColumn: h.includes("empate"),
        countsForLeague: true,
      });
    } else if (h.includes("liga")) {
      colSpecs.push({
        colA: c,
        colB: c + 1,
        matchType: "league",
        isDrawColumn: h.includes("empate"),
        countsForLeague: true,
      });
    }
  }

  // Parse MVPs lookup: matchNumber -> playerIds[]
  const mvpsByMatchNumber = new Map<number, string[]>();
  if (mvpColStart !== -1) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const numStr = cellText(ws.getRow(r).getCell(mvpColStart));
      if (!isIntegerString(numStr)) continue;
      const mNum = Number(numStr);
      const ids: string[] = [];
      for (let offset = 1; offset <= 2; offset++) {
        const rawMvp = cellText(ws.getRow(r).getCell(mvpColStart + offset));
        if (!rawMvp) continue;
        const reg = registry.getOrCreate(rawMvp);
        if (reg) ids.push(reg.playerId);
      }
      if (ids.length > 0) {
        mvpsByMatchNumber.set(mNum, ids);
      }
    }
  }

  // Parse Rest / Postponed calendar events
  if (restCol !== -1) {
    let currentType: "rest" | "postponed" = "rest";
    for (let r = 2; r <= ws.rowCount; r++) {
      const txt = cellText(ws.getRow(r).getCell(restCol));
      if (!txt) continue;
      if (txt.toLowerCase().includes("aplazad")) {
        currentType = "postponed";
        continue;
      }
      if (txt.toLowerCase().includes("descanso")) {
        currentType = "rest";
        continue;
      }
      const dateStr = parseSpanishDate(txt, season.year);
      calendarEvents.push({
        id: `cal-${season.year}-${currentType}-${r}`,
        seasonId: season.id,
        title: currentType === "rest" ? "Fecha de Descanso" : "Partido Aplazado",
        eventDate: dateStr,
        eventType: currentType,
      });
    }
  }

  // Parse each 2-column match block
  for (const spec of colSpecs) {
    let r = 2;
    while (r <= ws.rowCount) {
      const c1 = cellText(ws.getRow(r).getCell(spec.colA));
      const c2 = cellText(ws.getRow(r).getCell(spec.colB));

      // Special F11 sub-header inside the F11 column (e.g. "F11 Oktubre | F11 Oktubre")
      if (spec.matchType === "special_f11" && c1.toLowerCase().startsWith("f11")) {
        r++;
        continue;
      }

      const header = isMatchHeader(c1, c2);
      const isSpecialDateRow =
        spec.matchType === "special_f11" && !c1 && Boolean(c2);

      if (!header && !isSpecialDateRow) {
        r++;
        continue;
      }

      const matchNumber = header ? header.matchNumber : null;
      const matchDate = parseSpanishDate(c2, season.year);
      const notes =
        header && header.label !== String(header.matchNumber)
          ? header.label
          : spec.matchType === "special_f11"
            ? cellText(headerRow.getCell(spec.colA))
            : null;

      let teamAScore: number | null = null;
      let teamBScore: number | null = null;
      const players: MatchPlayer[] = [];
      const matchId = `m-${season.year}-${spec.matchType}-${matchNumber ?? `r${r}`}-${spec.isDrawColumn ? "d" : "w"}`;

      let cursor = r + 1;
      // Check if cursor row is a score row or cup captain+score row
      if (cursor <= ws.rowCount) {
        const s1 = cellText(ws.getRow(cursor).getCell(spec.colA));
        const s2 = cellText(ws.getRow(cursor).getCell(spec.colB));

        if (isIntegerString(s1) && isIntegerString(s2)) {
          teamAScore = Number(s1);
          teamBScore = Number(s2);
          cursor++;
        } else if (
          spec.matchType === "special_f11" &&
          /^\d+\s*\(\d+\)$/.test(s1) &&
          /^\d+\s*\(\d+\)$/.test(s2)
        ) {
          // e.g. "2 (3) | 2 (0)" penalty shootout
          teamAScore = Number(s1.match(/^(\d+)/)?.[1] ?? 0);
          teamBScore = Number(s2.match(/^(\d+)/)?.[1] ?? 0);
          cursor++;
        } else if (spec.matchType === "cup" && s1 && s2) {
          const capA = parseCupCaptainCell(s1);
          const capB = parseCupCaptainCell(s2);
          if (capA.score !== null && capB.score !== null) {
            teamAScore = capA.score;
            teamBScore = capB.score;
            const regA = registry.getOrCreate(capA.canonicalName);
            const regB = registry.getOrCreate(capB.canonicalName);
            if (regA) {
              players.push({
                id: `${matchId}-${regA.playerId}`,
                matchId,
                playerId: regA.playerId,
                team: "A",
                isCupCaptain: true,
                goals: 0,
                assists: 0,
                adminRating: null,
                isMvp: false,
              });
            }
            if (regB) {
              players.push({
                id: `${matchId}-${regB.playerId}`,
                matchId,
                playerId: regB.playerId,
                team: "B",
                isCupCaptain: true,
                goals: 0,
                assists: 0,
                adminRating: null,
                isMvp: false,
              });
            }
            cursor++;
          }
        }
      }

      // Collect player rows until blank row or next match header
      while (cursor <= ws.rowCount) {
        const p1 = cellText(ws.getRow(cursor).getCell(spec.colA));
        const p2 = cellText(ws.getRow(cursor).getCell(spec.colB));

        if (!p1 && !p2) break;
        if (isMatchHeader(p1, p2)) break;
        if (spec.matchType === "special_f11" && p1.toLowerCase().startsWith("f11")) break;

        for (const [raw, team] of [
          [p1, "A"],
          [p2, "B"],
        ] as const) {
          if (!raw) continue;
          const reg = registry.getOrCreate(raw);
          if (!reg) continue;
          // Ignore non-playing attendees like "(asador)"
          if (reg.note && reg.note.toLowerCase().includes("asador")) continue;
          if (players.some((p) => p.playerId === reg.playerId)) continue;

          players.push({
            id: `${matchId}-${reg.playerId}`,
            matchId,
            playerId: reg.playerId,
            team,
            isCupCaptain: reg.isCaptain,
            goals: 0,
            assists: 0,
            adminRating: null,
            isMvp: false,
          });
        }
        cursor++;
      }

      if (players.length > 0) {
        // Attach MVPs by match number
        if (matchNumber !== null) {
          const mvpIds = mvpsByMatchNumber.get(matchNumber) ?? [];
          for (const mp of players) {
            if (mvpIds.includes(mp.playerId)) {
              mp.isMvp = true;
            }
          }
        }

        const teamACount = players.filter((p) => p.team === "A").length;
        const teamBCount = players.filter((p) => p.team === "B").length;

        const resultOutcome: "A" | "B" | "draw" | null =
          teamAScore !== null && teamBScore !== null
            ? teamAScore > teamBScore
              ? "A"
              : teamBScore > teamAScore
                ? "B"
                : "draw"
            : spec.isDrawColumn
              ? "draw"
              : "A"; // In LOLONMEBOL Excel, left column is always Winner when not in Empates column

        matches.push({
          id: matchId,
          seasonId: season.id,
          matchNumber,
          matchDate,
          matchType: spec.matchType,
          modality: inferModality(teamACount, teamBCount, spec.matchType),
          teamAScore,
          teamBScore,
          resultOutcome,
          countsForLeague: spec.countsForLeague,
          countsForStats: true,
          votingStatus: "closed",
          externalSourceKey: `${season.year}-${spec.matchType}-${matchNumber ?? `r${r}`}`,
          notes,
          players,
        });
      }

      r = cursor;
    }
  }

  return matches;
}

function mergeRendimientosSheet(
  ws: ExcelJS.Worksheet,
  seasonId: string,
  matches: Match[],
  registry: PlayerRegistry
): void {
  // Find match number column mapping from row 3 ("Jugador | Total | Total | 1 | 2 | 3 ...")
  const colToMatchNumber = new Map<number, number>();
  const headerRow = ws.getRow(3);
  for (let c = 4; c <= ws.columnCount; c++) {
    const val = cellText(headerRow.getCell(c));
    if (isIntegerString(val)) {
      colToMatchNumber.set(c, Number(val));
    }
  }

  const seasonMatchesByNumber = new Map<number, Match>();
  for (const m of matches) {
    if (m.seasonId === seasonId && m.matchNumber !== null) {
      seasonMatchesByNumber.set(m.matchNumber, m);
    }
  }

  let inRatingsSection = false;
  let ratingsColToMatchNumber = new Map<number, number>();

  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const col1 = cellText(row.getCell(1));
    const col2 = cellText(row.getCell(2));

    if (!col1) continue;

    if (col1.toLowerCase().includes("calificaciones")) {
      inRatingsSection = true;
      continue;
    }

    if (inRatingsSection) {
      if (col1.toLowerCase() === "jugador") {
        // Parse ratings header row for match numbers
        for (let c = 3; c <= ws.columnCount; c++) {
          const v = cellText(row.getCell(c));
          if (isIntegerString(v)) {
            ratingsColToMatchNumber.set(c, Number(v));
          }
        }
        continue;
      }

      const reg = registry.getOrCreate(col1);
      if (!reg) continue;

      const mapToUse =
        ratingsColToMatchNumber.size > 0
          ? ratingsColToMatchNumber
          : colToMatchNumber;

      for (const [colIdx, mNum] of mapToUse.entries()) {
        const rating = cellNumber(row.getCell(colIdx));
        if (rating === null || rating < 0 || rating > 10) continue;
        const match = seasonMatchesByNumber.get(mNum);
        const mp = match?.players.find((p) => p.playerId === reg.playerId);
        if (mp) {
          mp.adminRating = rating;
        }
      }
      continue;
    }

    // Goals & Assists section
    if (col2 !== "G" && col2 !== "A") continue;
    const reg = registry.getOrCreate(col1);
    if (!reg) continue;

    for (const [colIdx, mNum] of colToMatchNumber.entries()) {
      const value = cellNumber(row.getCell(colIdx));
      if (value === null) continue;
      const match = seasonMatchesByNumber.get(mNum);
      const mp = match?.players.find((p) => p.playerId === reg.playerId);
      if (!mp) continue;

      if (col2 === "G") mp.goals = Math.max(0, Math.round(value));
      if (col2 === "A") mp.assists = Math.max(0, Math.round(value));
    }
  }
}

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function parsePozoSheet(
  ws: ExcelJS.Worksheet,
  season: Season,
  registry: PlayerRegistry,
  fundMonths: FundMonth[],
  fundPayments: FundPayment[],
  fundTransactions: FundTransaction[]
): void {
  // Find player header row (row 1 or row 2)
  let headerRowIdx = 1;
  if (cellText(ws.getRow(1).getCell(1)).toLowerCase().includes("pozo")) {
    headerRowIdx = 2;
  }

  const playerCols = new Map<number, string>();
  const hRow = ws.getRow(headerRowIdx);
  for (let c = 2; c <= ws.columnCount; c++) {
    const raw = cellText(hRow.getCell(c));
    if (!raw) continue;
    const reg = registry.getOrCreate(raw);
    if (reg) playerCols.set(c, reg.playerId);
  }

  const defaultFee = season.year === 2025 ? 2000 : 3000;

  for (let r = headerRowIdx + 1; r <= Math.min(35, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const label = cellText(row.getCell(1));
    if (!label) continue;
    const lower = label.toLowerCase();

    if (MONTH_NAME_TO_NUMBER[lower]) {
      const monthNumber = MONTH_NAME_TO_NUMBER[lower];
      const fmId = `fm-${season.year}-${monthNumber}`;
      fundMonths.push({
        id: fmId,
        seasonId: season.id,
        monthNumber,
        monthLabel: label,
        feeAmount: defaultFee,
      });

      for (const [colIdx, playerId] of playerCols.entries()) {
        const val = cellText(row.getCell(colIdx)).toLowerCase();
        const paid = val.includes("pag");
        fundPayments.push({
          id: `fp-${fmId}-${playerId}`,
          fundMonthId: fmId,
          playerId,
          paid,
        });
      }
    } else if (lower.includes("rendimiento")) {
      // Find first numeric value in row
      for (let c = 2; c <= ws.columnCount; c++) {
        const n = cellNumber(row.getCell(c));
        if (n !== null && n > 0) {
          fundTransactions.push({
            id: `ftx-${season.year}-yield-${r}`,
            seasonId: season.id,
            txType: "yield",
            amount: n,
            description: `Rendimientos ${season.year}`,
            txDate: `${season.year}-12-01`,
          });
          break;
        }
      }
    } else if (lower.includes("premio") || lower.includes("gasto")) {
      for (let c = 2; c <= ws.columnCount; c++) {
        const n = cellNumber(row.getCell(c));
        if (n !== null && n > 0) {
          fundTransactions.push({
            id: `ftx-${season.year}-expense-${r}`,
            seasonId: season.id,
            txType: "expense",
            amount: n,
            description: `${label} ${season.year}`,
            txDate: `${season.year}-12-15`,
          });
          break;
        }
      }
    }
  }
}

export async function parseLolonmebolWorkbook(
  workbook: ExcelJS.Workbook
): Promise<TournamentDataset> {
  const registry = new PlayerRegistry();
  const seasons: Season[] = [];
  const matches: Match[] = [];
  const calendarEvents: CalendarEvent[] = [];
  const fundMonths: FundMonth[] = [];
  const fundPayments: FundPayment[] = [];
  const fundTransactions: FundTransaction[] = [];

  // Detect seasons from `Fechas XX` sheets
  const fechasSheets = workbook.worksheets
    .map((ws) => {
      const m = ws.name.match(/^Fechas\s+(\d{2})$/i);
      return m ? { ws, year: 2000 + Number(m[1]), shortYear: m[1] } : null;
    })
    .filter((x): x is { ws: ExcelJS.Worksheet; year: number; shortYear: string } => x !== null)
    .sort((a, b) => a.year - b.year);

  const latestYear =
    fechasSheets.length > 0
      ? fechasSheets[fechasSheets.length - 1].year
      : new Date().getFullYear();

  for (const { ws, year, shortYear } of fechasSheets) {
    const season: Season = {
      id: `season-${year}`,
      year,
      name: `Temporada ${year}`,
      status: year === latestYear ? "active" : "finished",
      cupCutoffDate: `${year}-07-01`,
    };
    seasons.push(season);

    const parsedMatches = parseFechasSheet(ws, season, registry, calendarEvents);
    matches.push(...parsedMatches);

    // Merge Rendimientos XX if present
    const rendSheet = workbook.getWorksheet(`Rendimientos ${shortYear}`);
    if (rendSheet) {
      mergeRendimientosSheet(rendSheet, season.id, matches, registry);
    }

    // Parse Pozo sheet if present
    const pozoSheet =
      workbook.getWorksheet(`Pozo y premios ${shortYear}`) ??
      workbook.getWorksheet(`Pozo ${shortYear}`);
    if (pozoSheet) {
      parsePozoSheet(
        pozoSheet,
        season,
        registry,
        fundMonths,
        fundPayments,
        fundTransactions
      );
    }
  }

  // Official validated titles from Reglamento Oficial §3.4
  const titles: PlayerTitle[] = [];
  if (registry.players.has("b-aguzzi") && seasons.some((s) => s.year === 2025)) {
    titles.push(
      {
        id: "title-2025-cup-aguzzi",
        playerId: "b-aguzzi",
        seasonId: "season-2025",
        titleType: "cup",
        awardedAt: "2025-11-30",
      },
      {
        id: "title-2025-lolonmebol-aguzzi",
        playerId: "b-aguzzi",
        seasonId: "season-2025",
        titleType: "lolonmebol",
        awardedAt: "2025-12-22",
      }
    );
  }
  if (registry.players.has("b-aguzzi") && seasons.some((s) => s.year === 2026)) {
    titles.push({
      id: "title-2026-league-aguzzi",
      playerId: "b-aguzzi",
      seasonId: "season-2026",
      titleType: "league",
      awardedAt: "2026-12-01",
    });
  }
  if (registry.players.has("pipo") && seasons.some((s) => s.year === 2025)) {
    titles.push({
      id: "title-2025-league-pipo",
      playerId: "pipo",
      seasonId: "season-2025",
      titleType: "league",
      awardedAt: "2025-12-10",
    });
  }

  // Generate calendar events from matches as well
  for (const m of matches) {
    calendarEvents.push({
      id: `cal-match-${m.id}`,
      seasonId: m.seasonId,
      title:
        m.matchType === "cup"
          ? `Copa — Fecha ${m.matchNumber ?? ""}`.trim()
          : m.matchType === "lolonmebol"
            ? "Final LOLONMEBOL"
            : m.matchType === "special_f11"
              ? m.notes || "Fecha Especial F11"
              : `Liga — Fecha ${m.matchNumber ?? ""}`.trim(),
      description: m.notes ?? undefined,
      eventDate: m.matchDate,
      eventType:
        m.matchType === "league_tiebreaker" ? "league" : m.matchType,
      matchId: m.id,
    });
  }

  const announcements: Announcement[] = [
    {
      id: "ann-welcome",
      title: "Bienvenidos a LolonmeApp Oficial",
      body: "Ya están cargadas las temporadas 2025 y 2026 directamente desde LOLONMEBOL.xlsx. Consultá tablas, Copa, química y consistencia desde el celular.",
      isPinned: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // Build Cup Editions for each season
  const cupEditions: CupEdition[] = seasons.map((s) => ({
    id: `cup-${s.year}`,
    seasonId: s.id,
    name: `Copa LOLONMEBOL ${s.year}`,
    cutoffSnapshotPlayerIds: [],
  }));
  const cupTies: CupTie[] = [];

  return {
    seasons,
    players: Array.from(registry.players.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es")
    ),
    aliases: Array.from(registry.aliases.values()),
    titles,
    matches: matches.sort((a, b) => b.matchDate.localeCompare(a.matchDate)),
    calendarEvents: calendarEvents.sort((a, b) =>
      b.eventDate.localeCompare(a.eventDate)
    ),
    announcements,
    cupEditions,
    cupTies,
    fundMonths,
    fundPayments,
    fundTransactions,
  };
}

export async function parseLolonmebolWorkbookFile(
  filePath: string
): Promise<TournamentDataset> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return parseLolonmebolWorkbook(wb);
}

export async function parseLolonmebolWorkbookBuffer(
  buffer: ArrayBuffer | Uint8Array
): Promise<TournamentDataset> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  return parseLolonmebolWorkbook(wb);
}
