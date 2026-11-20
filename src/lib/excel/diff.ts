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

function matchFingerprint(m: Match): string {
  const playersKey = [...m.players]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map(
      (p) =>
        `${p.playerId}:${p.team}:${p.isCupCaptain ? 1 : 0}:${p.goals}:${p.assists}:${p.adminRating ?? ""}:${p.isMvp ? 1 : 0}`
    )
    .join("|");
  return `${m.matchDate}|${m.teamAScore ?? ""}|${m.teamBScore ?? ""}|${m.resultOutcome ?? ""}|${m.modality}|${playersKey}`;
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

  // Merge players (preserve existing roles/emails/nicknames)
  const playersMap = new Map(existing.players.map((p) => [p.id, p]));
  for (const np of diff.newPlayers) {
    playersMap.set(np.id, np);
  }

  // Merge seasons
  const seasonsMap = new Map(existing.seasons.map((s) => [s.id, s]));
  for (const s of incoming.seasons) {
    if (!seasonsMap.has(s.id)) seasonsMap.set(s.id, s);
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
    if (options.overwriteExisting && updatedKeySet.has(key)) {
      return incomingByKey.get(key)!;
    }
    return m;
  });

  mergedMatches.push(...diff.newMatches);

  return {
    ...existing,
    seasons: Array.from(seasonsMap.values()).sort((a, b) => a.year - b.year),
    players: Array.from(playersMap.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es")
    ),
    matches: mergedMatches.sort((a, b) =>
      b.matchDate.localeCompare(a.matchDate)
    ),
  };
}
