import type { CupTie, Match } from "@/lib/types/domain";

export interface GenerateCupBracketInput {
  editionId: string;
  /** Ordered player IDs from 1st to last at cutoff date */
  standingsPlayerIds: string[];
  /** The 2 finalists from the previous LOLONMEBOL final (always qualify & skip Preliminary) */
  previousLolonmebolFinalistIds: string[];
}

export function generateCupBracket({
  editionId,
  standingsPlayerIds,
  previousLolonmebolFinalistIds,
}: GenerateCupBracketInput): CupTie[] {
  const finalistSet = new Set(previousLolonmebolFinalistIds);

  // Collect 9 qualifiers: always include the 2 previous finalists, fill remaining slots from top of standings
  const qualifiersSet = new Set<string>(
    previousLolonmebolFinalistIds.filter((id) => Boolean(id))
  );

  for (const playerId of standingsPlayerIds) {
    if (qualifiersSet.size >= 9) break;
    qualifiersSet.add(playerId);
  }

  // Order qualifiers by their cutoff standings rank (unranked finalists go after ranked ones)
  const rankOf = (id: string) => {
    const idx = standingsPlayerIds.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  const orderedQualifiers = Array.from(qualifiersSet).sort(
    (a, b) => rankOf(a) - rankOf(b)
  );

  // Preliminary round: 2 lowest-ranked qualifiers who are NOT previous LOLONMEBOL finalists
  const nonFinalists = orderedQualifiers.filter((id) => !finalistSet.has(id));
  const prelimPlayers = nonFinalists.slice(-2);
  const prelimSet = new Set(prelimPlayers);

  // Direct 7 to Quarterfinals, ordered 1..7 by standings rank
  const directQuarterfinalists = orderedQualifiers.filter(
    (id) => !prelimSet.has(id)
  );

  const seedMap = new Map<string, number>();
  orderedQualifiers.forEach((id, idx) => seedMap.set(id, idx + 1));

  const ties: CupTie[] = [];

  // Preliminary tie
  ties.push({
    id: `${editionId}-prelim-1`,
    cupEditionId: editionId,
    round: "preliminary",
    slotOrder: 1,
    playerAId: prelimPlayers[0] ?? null,
    playerBId: prelimPlayers[1] ?? null,
    seedA: prelimPlayers[0] ? seedMap.get(prelimPlayers[0]) ?? null : null,
    seedB: prelimPlayers[1] ? seedMap.get(prelimPlayers[1]) ?? null : null,
    leg1MatchId: null,
    leg2MatchId: null,
    overrideScoreA: null,
    overrideScoreB: null,
    winnerPlayerId: null,
    notes: "Fase Previa (2 últimos clasificados no finalistas LOLONMEBOL)",
  });

  // Quarterfinals: 1° vs GFP, 2° vs 7°, 3° vs 6°, 4° vs 5°
  const qfPairs: Array<[string | null, string | null]> = [
    [directQuarterfinalists[0] ?? null, null], // 1° vs GFP
    [directQuarterfinalists[1] ?? null, directQuarterfinalists[6] ?? null],
    [directQuarterfinalists[2] ?? null, directQuarterfinalists[5] ?? null],
    [directQuarterfinalists[3] ?? null, directQuarterfinalists[4] ?? null],
  ];

  qfPairs.forEach(([a, b], idx) => {
    ties.push({
      id: `${editionId}-qf-${idx + 1}`,
      cupEditionId: editionId,
      round: "quarterfinal",
      slotOrder: idx + 1,
      playerAId: a,
      playerBId: b,
      seedA: a ? seedMap.get(a) ?? null : null,
      seedB: b ? seedMap.get(b) ?? null : null,
      leg1MatchId: null,
      leg2MatchId: null,
      overrideScoreA: null,
      overrideScoreB: null,
      winnerPlayerId: null,
    });
  });

  // Semifinals & Final placeholders (editable by Admin)
  for (let i = 1; i <= 2; i++) {
    ties.push({
      id: `${editionId}-sf-${i}`,
      cupEditionId: editionId,
      round: "semifinal",
      slotOrder: i,
      playerAId: null,
      playerBId: null,
      seedA: null,
      seedB: null,
      leg1MatchId: null,
      leg2MatchId: null,
      overrideScoreA: null,
      overrideScoreB: null,
      winnerPlayerId: null,
    });
  }

  ties.push({
    id: `${editionId}-final-1`,
    cupEditionId: editionId,
    round: "final",
    slotOrder: 1,
    playerAId: null,
    playerBId: null,
    seedA: null,
    seedB: null,
    leg1MatchId: null,
    leg2MatchId: null,
    overrideScoreA: null,
    overrideScoreB: null,
    winnerPlayerId: null,
  });

  return ties;
}

export function getCupTieAggregate(
  tie: CupTie,
  matches: Match[]
): { scoreA: number; scoreB: number; hasScores: boolean } {
  if (tie.overrideScoreA !== null && tie.overrideScoreB !== null) {
    return {
      scoreA: tie.overrideScoreA,
      scoreB: tie.overrideScoreB,
      hasScores: true,
    };
  }

  let scoreA = 0;
  let scoreB = 0;
  let hasScores = false;

  const legIds = [tie.leg1MatchId, tie.leg2MatchId].filter(
    (id): id is string => Boolean(id)
  );

  for (const legId of legIds) {
    const match = matches.find((m) => m.id === legId);
    if (!match || match.teamAScore === null || match.teamBScore === null) {
      continue;
    }

    const playerAEntry = match.players.find((p) => p.playerId === tie.playerAId);
    const playerBEntry = match.players.find((p) => p.playerId === tie.playerBId);

    if (playerAEntry) {
      scoreA += playerAEntry.team === "A" ? match.teamAScore : match.teamBScore;
      hasScores = true;
    }
    if (playerBEntry) {
      scoreB += playerBEntry.team === "A" ? match.teamAScore : match.teamBScore;
      hasScores = true;
    }
  }

  return { scoreA, scoreB, hasScores };
}

export function resolveCupTieWinner(
  tie: CupTie,
  matches: Match[]
): string | null {
  if (tie.winnerPlayerId) return tie.winnerPlayerId;
  if (!tie.playerAId || !tie.playerBId) return null;

  const { scoreA, scoreB, hasScores } = getCupTieAggregate(tie, matches);
  if (!hasScores) return null;

  if (scoreA > scoreB) return tie.playerAId;
  if (scoreB > scoreA) return tie.playerBId;

  // Aggregate tie -> sports advantage (lower seed number = better standings position)
  if (tie.seedA !== null && tie.seedB !== null) {
    return tie.seedA < tie.seedB ? tie.playerAId : tie.playerBId;
  }

  return null;
}

export function resolveLolonmebolFinalists(
  leagueChampionId: string,
  leagueRunnerUpId: string,
  cupChampionId: string
): [string, string] {
  if (leagueChampionId === cupChampionId) {
    return [leagueChampionId, leagueRunnerUpId];
  }
  return [leagueChampionId, cupChampionId];
}
