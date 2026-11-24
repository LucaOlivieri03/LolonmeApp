import type { Match, Player, TournamentDataset } from "@/lib/types/domain";

export interface MatchChangeSummary {
  externalSourceKey: string;
  matchDate: string;
  matchNumber: number | null;
  changes: string[];
  incomingMatch: Match;
}

export interface ImportDiffPreview {
  newPlayers: Player[];
  newMatches: Match[];
  updatedMatches: MatchChangeSummary[];
  unchangedMatchesCount: number;
}

const NON_PLAYER_NOISE_ID =
  /^(f11|liga|copa|lolonmebol|descanso|partido|mvp|total|totales|subtotal|subtotales|rendimiento|rendimientos|gasto|gastos|premio|premios|saldo|pozo|cuota|cuotas|mes|jugador|jugadores|promedio|calificaciones|g\d+(?:-g\d+)?)$/i;

function mergeByKey<T>(
  existingItems: T[],
  incomingItems: T[],
  getKey: (item: T) => string,
  overwriteExisting: boolean
): T[] {
  const map = new Map(existingItems.map((item) => [getKey(item), item]));
  for (const item of incomingItems) {
    const key = getKey(item);
    if (overwriteExisting || !map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function mergeById<T extends { id: string }>(
  existingItems: T[],
  incomingItems: T[],
  overwriteExisting: boolean
): T[] {
  return mergeByKey(existingItems, incomingItems, (item) => item.id, overwriteExisting);
}

function matchFingerprint(m: Match): string {
  const playersKey = [...m.players]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map(
      (p) =>
        `${p.playerId}:${p.team}:${p.isCupCaptain ? 1 : 0}:${p.goals}:${p.assists}:${p.adminRating ?? ""}:${p.isMvp ? 1 : 0}`
    )
    .join("|");
  return `${m.matchDate}|${m.teamAScore ?? ""}|${m.teamBScore ?? ""}|${m.resultOutcome ?? ""}|${m.modality}|${m.countsForLeague ? 1 : 0}|${m.countsForStats ? 1 : 0}|${m.notes ?? ""}|${playersKey}`;
}

function describeMatchDiff(existing: Match, incoming: Match): string[] {
  const changes: string[] = [];
  if (existing.matchDate !== incoming.matchDate) {
    changes.push(`Fecha: ${existing.matchDate} → ${incoming.matchDate}`);
  }
  if (
    existing.teamAScore !== incoming.teamAScore ||
    existing.teamBScore !== incoming.teamBScore
  ) {
    changes.push(
      `Marcador: ${existing.teamAScore ?? "-"}-${existing.teamBScore ?? "-"} → ${incoming.teamAScore ?? "-"}-${incoming.teamBScore ?? "-"}`
    );
  }
  if ((existing.notes ?? null) !== (incoming.notes ?? null)) {
    changes.push(
      `Detalle: ${existing.notes ?? "-"} → ${incoming.notes ?? "-"}`
    );
  }
  if (
    existing.countsForLeague !== incoming.countsForLeague ||
    existing.countsForStats !== incoming.countsForStats
  ) {
    changes.push("Reglas de cómputo (Liga / Estadísticas)");
  }
  if (existing.players.length !== incoming.players.length) {
    changes.push(
      `Jugadores: ${existing.players.length} → ${incoming.players.length}`
    );
  } else if (matchFingerprint(existing) !== matchFingerprint(incoming)) {
    changes.push("Actualización de estadísticas / formaciones / MVPs");
  }
  return changes;
}

export function computeImportDiff(
  existing: TournamentDataset,
  incoming: TournamentDataset
): ImportDiffPreview {
  const existingPlayerIds = new Set(existing.players.map((p) => p.id));
  const newPlayers = incoming.players.filter(
    (p) => !existingPlayerIds.has(p.id)
  );

  const existingByKey = new Map<string, Match>();
  for (const m of existing.matches) {
    if (m.externalSourceKey) {
      existingByKey.set(m.externalSourceKey, m);
    }
  }

  const newMatches: Match[] = [];
  const updatedMatches: MatchChangeSummary[] = [];
  let unchangedMatchesCount = 0;

  for (const m of incoming.matches) {
    const key = m.externalSourceKey ?? m.id;
    const prev = existingByKey.get(key);
    if (!prev) {
      newMatches.push(m);
    } else if (matchFingerprint(prev) !== matchFingerprint(m)) {
      updatedMatches.push({
        externalSourceKey: key,
        matchDate: m.matchDate,
        matchNumber: m.matchNumber,
        changes: describeMatchDiff(prev, m),
        incomingMatch: m,
      });
    } else {
      unchangedMatchesCount += 1;
    }
  }

  return {
    newPlayers,
    newMatches,
    updatedMatches,
    unchangedMatchesCount,
  };
}

export function applyImportDiff(
  existing: TournamentDataset,
  incoming: TournamentDataset,
  options: { overwriteExisting: boolean }
): TournamentDataset {
  const diff = computeImportDiff(existing, incoming);
  const { overwriteExisting } = options;

  // Merge players (preserve existing roles/emails/nicknames while purging legacy header noise)
  const playersMap = new Map(
    existing.players
      .filter((p) => !NON_PLAYER_NOISE_ID.test(p.id))
      .map((p) => [p.id, p])
  );
  for (const np of incoming.players) {
    if (NON_PLAYER_NOISE_ID.test(np.id)) continue;
    const prev = playersMap.get(np.id);
    if (!prev) {
      playersMap.set(np.id, np);
    } else if (overwriteExisting) {
      playersMap.set(np.id, {
        ...prev,
        displayName: np.displayName,
      });
    }
  }

  // Merge seasons
  const seasonsMap = new Map(existing.seasons.map((s) => [s.id, s]));
  for (const s of incoming.seasons) {
    if (overwriteExisting || !seasonsMap.has(s.id)) {
      seasonsMap.set(s.id, s);
    }
  }

  // Merge matches
  const updatedKeySet = new Set(
    diff.updatedMatches.map((u) => u.externalSourceKey)
  );
  const incomingByKey = new Map(
    diff.updatedMatches.map((u) => [u.externalSourceKey, u.incomingMatch])
  );

  const mergedMatches = existing.matches.map((m) => {
    const key = m.externalSourceKey ?? m.id;
    if (overwriteExisting && updatedKeySet.has(key)) {
      return incomingByKey.get(key)!;
    }
    return m;
  });

  mergedMatches.push(...diff.newMatches);

  // Merge aliases and titles by natural domain keys; remaining entities by canonical IDs
  const mergedAliases = mergeByKey(
    existing.aliases.filter((a) => !NON_PLAYER_NOISE_ID.test(a.playerId)),
    incoming.aliases,
    (a) => a.rawName,
    overwriteExisting
  );
  const mergedTitles = mergeByKey(
    existing.titles,
    incoming.titles,
    (t) => `${t.seasonId}|${t.playerId}|${t.titleType}`,
    overwriteExisting
  );
  const mergedCalendarEvents = mergeById(
    existing.calendarEvents,
    incoming.calendarEvents,
    overwriteExisting
  ).sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  const incomingEditionIds = new Set(incoming.cupEditions.map((e) => e.id));
  const mergedCupEditions = mergeById(
    existing.cupEditions,
    incoming.cupEditions,
    overwriteExisting
  );
  const baseCupTies = overwriteExisting
    ? existing.cupTies.filter((t) => !incomingEditionIds.has(t.cupEditionId))
    : existing.cupTies;
  const mergedCupTies = mergeById(
    baseCupTies,
    incoming.cupTies,
    overwriteExisting
  );

  const incomingSeasonIds = new Set(incoming.seasons.map((s) => s.id));
  const mergedFundMonths = mergeById(
    existing.fundMonths,
    incoming.fundMonths,
    overwriteExisting
  );
  const mergedFundPayments = mergeById(
    existing.fundPayments.filter((fp) => !NON_PLAYER_NOISE_ID.test(fp.playerId)),
    incoming.fundPayments.filter((fp) => !NON_PLAYER_NOISE_ID.test(fp.playerId)),
    overwriteExisting
  );
  const baseFundTransactions = overwriteExisting
    ? existing.fundTransactions.filter(
        (tx) => !incomingSeasonIds.has(tx.seasonId) || !tx.id.startsWith("ftx-")
      )
    : existing.fundTransactions;
  const mergedFundTransactions = mergeById(
    baseFundTransactions,
    incoming.fundTransactions,
    overwriteExisting
  );

  return {
    ...existing,
    seasons: Array.from(seasonsMap.values()).sort((a, b) => a.year - b.year),
    players: Array.from(playersMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es")
    ),
    aliases: mergedAliases,
    titles: mergedTitles,
    matches: mergedMatches.sort((a, b) =>
      b.matchDate.localeCompare(a.matchDate)
    ),
    calendarEvents: mergedCalendarEvents,
    cupEditions: mergedCupEditions,
    cupTies: mergedCupTies,
    fundMonths: mergedFundMonths,
    fundPayments: mergedFundPayments,
    fundTransactions: mergedFundTransactions,
  };
}
