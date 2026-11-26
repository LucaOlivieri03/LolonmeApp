import type { MatchLedgerPlayerItem } from "@/lib/types/view-models";

export interface TokenPosition {
  /** Percentage from left edge of pitch [8..92] */
  x: number;
  /** Percentage from top edge of pitch (Team A: [7..46], Team B: [54..93]) */
  y: number;
}

export const PITCH_BOUNDS = {
  minX: 8,
  maxX: 92,
  teamA: { minY: 7, maxY: 46 },
  teamB: { minY: 54, maxY: 93 },
} as const;

export function clampTokenPosition(
  team: "A" | "B",
  x: number,
  y: number
): TokenPosition {
  const boundsY = team === "A" ? PITCH_BOUNDS.teamA : PITCH_BOUNDS.teamB;
  const clampedX = Math.min(PITCH_BOUNDS.maxX, Math.max(PITCH_BOUNDS.minX, x));
  const clampedY = Math.min(boundsY.maxY, Math.max(boundsY.minY, y));
  return {
    x: Math.round(clampedX * 100) / 100,
    y: Math.round(clampedY * 100) / 100,
  };
}

/**
 * Splits `count` players into realistic tactical rows (from goalkeeper toward midfield).
 */
function buildFormationRows(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count === 2) return [1, 1];
  if (count === 3) return [1, 2];
  if (count === 4) return [1, 2, 1];
  if (count === 5) return [1, 2, 1, 1];
  if (count === 6) return [1, 2, 2, 1];
  if (count === 7) return [1, 3, 2, 1];
  if (count === 8) return [1, 3, 2, 2];
  if (count === 9) return [1, 3, 3, 2];
  if (count === 10) return [1, 4, 3, 2];
  if (count === 11) return [1, 4, 3, 3];

  // Fallback for >11 players: 1 GK + rows of max 4
  const rows: number[] = [1];
  let remaining = count - 1;
  while (remaining > 0) {
    const take = Math.min(4, remaining);
    rows.push(take);
    remaining -= take;
  }
  return rows;
}

function layoutHalf(
  players: Pick<MatchLedgerPlayerItem, "id">[],
  team: "A" | "B"
): Record<string, TokenPosition> {
  const result: Record<string, TokenPosition> = {};
  const rows = buildFormationRows(players.length);
  if (rows.length === 0) return result;

  // Vertical depth anchor per row from goal toward halfway line
  const rowDepths: number[] =
    rows.length === 1
      ? [0.45]
      : rows.map((_, idx) => {
          const t = idx / (rows.length - 1);
          return 0.08 + t * 0.78; // 0.08 near goal -> 0.86 near midfield
        });

  let cursor = 0;
  for (let r = 0; r < rows.length; r++) {
    const rowSize = rows[r];
    const depth = rowDepths[r];
    // Map normalized depth [0..1] onto team's half
    const rawY =
      team === "A"
        ? PITCH_BOUNDS.teamA.minY +
          depth * (PITCH_BOUNDS.teamA.maxY - PITCH_BOUNDS.teamA.minY)
        : PITCH_BOUNDS.teamB.maxY -
          depth * (PITCH_BOUNDS.teamB.maxY - PITCH_BOUNDS.teamB.minY);

    for (let c = 0; c < rowSize; c++) {
      const player = players[cursor];
      if (!player) break;
      const rawX =
        rowSize === 1
          ? 50
          : PITCH_BOUNDS.minX +
            8 +
            (c / (rowSize - 1)) * (PITCH_BOUNDS.maxX - PITCH_BOUNDS.minX - 16);

      result[player.id] = clampTokenPosition(team, rawX, rawY);
      cursor += 1;
    }
  }

  return result;
}

export function computeInitialFormation(
  teamA: Pick<MatchLedgerPlayerItem, "id">[],
  teamB: Pick<MatchLedgerPlayerItem, "id">[]
): Record<string, TokenPosition> {
  return {
    ...layoutHalf(teamA, "A"),
    ...layoutHalf(teamB, "B"),
  };
}
