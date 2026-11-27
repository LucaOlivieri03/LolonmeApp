import "server-only";
import {
  assertAuthenticatedPlayer,
  assertOperator,
  isAuthError,
  type ViewerSession,
} from "@/server/auth";
import type {
  ActionResult,
  CloseMatchVotingInput,
  OpenMatchVotingInput,
  SubmitMatchVotesInput,
} from "@/lib/types/admin-actions";
import {
  computeWinningMvpPlayerIds,
  validateMatchBallot,
} from "@/lib/voting/engine";
import type { AdminDbClient, DbErrorLike } from "./mutations-core";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unconfiguredResult(): ActionResult<never> {
  return {
    ok: false,
    code: "UNCONFIGURED",
    error:
      "Supabase no está configurado en este entorno. Conectá la base de datos para guardar votaciones.",
  };
}

function authErrorResult(err: unknown): ActionResult<never> {
  if (isAuthError(err)) {
    return {
      ok: false,
      code: err.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN",
      error: err.message,
    };
  }
  return {
    ok: false,
    code: "INTERNAL",
    error: err instanceof Error ? err.message : "Error interno inesperado.",
  };
}

function dbErrorResult(
  err: DbErrorLike,
  fallbackMessage: string
): ActionResult<never> {
  if (err.code === "42501") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "No tenés permisos para realizar esta acción.",
    };
  }
  console.error(
    `[voting] Database error (${err.code ?? "unknown"}):`,
    err.message
  );
  return {
    ok: false,
    code: "INTERNAL",
    error: fallbackMessage,
  };
}

async function resolveMatchRow(
  client: AdminDbClient,
  matchIdOrSlug: string
): Promise<{ id: string; voting_status: "open" | "closed" } | null> {
  const trimmed = matchIdOrSlug.trim();
  if (!trimmed) return null;

  const column = UUID_REGEX.test(trimmed) ? "id" : "slug";
  const res = await client
    .from("matches")
    .select("id, voting_status")
    .eq(column, trimmed)
    .maybeSingle();

  if (res.error || !res.data) return null;
  const row = res.data as { id?: string; voting_status?: "open" | "closed" };
  if (!row.id || !row.voting_status) return null;
  return { id: row.id, voting_status: row.voting_status };
}

export async function performOpenMatchVoting(
  client: AdminDbClient | null,
  session: ViewerSession,
  input: OpenMatchVotingInput
): Promise<ActionResult<{ matchId: string; votingStatus: "open" }>> {
  try {
    assertOperator(session);
  } catch (err) {
    return authErrorResult(err);
  }

  if (!client) return unconfiguredResult();

  const matchRow = await resolveMatchRow(client, input.matchId);
  if (!matchRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "No se encontró el partido indicado.",
    };
  }

  const updateRes = await client
    .from("matches")
    .update({
      voting_status: "open",
      voting_closed_at: null,
      voting_closed_by: null,
    })
    .eq("id", matchRow.id);

  if (updateRes.error) {
    return dbErrorResult(updateRes.error, "No se pudo abrir la votación.");
  }

  return {
    ok: true,
    message: "Votación abierta. Los participantes ya pueden votar.",
    data: { matchId: input.matchId, votingStatus: "open" },
  };
}

export async function performCloseMatchVoting(
  client: AdminDbClient | null,
  session: ViewerSession,
  input: CloseMatchVotingInput
): Promise<
  ActionResult<{
    matchId: string;
    votingStatus: "closed";
    winningMvpPlayerUuids: string[];
  }>
> {
  let operator;
  try {
    operator = assertOperator(session);
  } catch (err) {
    return authErrorResult(err);
  }

  if (!client) return unconfiguredResult();

  const matchRow = await resolveMatchRow(client, input.matchId);
  if (!matchRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "No se encontró el partido indicado.",
    };
  }

  const closeRes = await client
    .from("matches")
    .update({
      voting_status: "closed",
      voting_closed_at: new Date().toISOString(),
      voting_closed_by: operator.playerUuid,
    })
    .eq("id", matchRow.id);

  if (closeRes.error) {
    return dbErrorResult(closeRes.error, "No se pudo cerrar la votación.");
  }

  const votesRes = await client
    .from("match_votes")
    .select("target_player_id, voted_mvp")
    .eq("match_id", matchRow.id);

  const voteRows =
    !votesRes.error && Array.isArray(votesRes.data)
      ? (votesRes.data as Array<{
          target_player_id: string;
          voted_mvp: boolean;
        }>)
      : [];

  const computedWinners = computeWinningMvpPlayerIds(
    voteRows.map((row) => ({
      targetPlayerId: row.target_player_id,
      votedMvp: Boolean(row.voted_mvp),
    }))
  );

  let finalMvpUuids = computedWinners;
  if (
    Array.isArray(input.overrideMvpPlayerIds) &&
    input.overrideMvpPlayerIds.length > 0
  ) {
    const resolvedOverrides: string[] = [];
    for (const rawId of input.overrideMvpPlayerIds) {
      const trimmed = rawId.trim();
      if (!trimmed) continue;
      if (UUID_REGEX.test(trimmed)) {
        resolvedOverrides.push(trimmed);
      } else {
        const pRes = await client
          .from("players")
          .select("id")
          .eq("slug", trimmed)
          .maybeSingle();
        const found = pRes.data as { id?: string } | null;
        if (found?.id) resolvedOverrides.push(found.id);
      }
    }
    if (resolvedOverrides.length > 0) {
      finalMvpUuids = resolvedOverrides;
    }
  }

  const shouldApplyMvp = input.applyVotedMvp !== false && finalMvpUuids.length > 0;
  if (shouldApplyMvp) {
    const clearRes = await client
      .from("match_players")
      .update({ is_mvp: false })
      .eq("match_id", matchRow.id);
    if (clearRes.error) {
      return dbErrorResult(
        clearRes.error,
        "La votación se cerró, pero falló la actualización del MVP."
      );
    }

    const setRes = await client
      .from("match_players")
      .update({ is_mvp: true })
      .eq("match_id", matchRow.id)
      .in("player_id", finalMvpUuids);
    if (setRes.error) {
      return dbErrorResult(
        setRes.error,
        "La votación se cerró, pero falló la asignación del MVP."
      );
    }
  }

  return {
    ok: true,
    message:
      shouldApplyMvp
        ? "Votación cerrada, votos publicados y MVP actualizado."
        : "Votación cerrada y votos publicados con transparencia.",
    data: {
      matchId: input.matchId,
      votingStatus: "closed",
      winningMvpPlayerUuids: finalMvpUuids,
    },
  };
}

export async function performSubmitMatchVotes(
  client: AdminDbClient | null,
  session: ViewerSession,
  input: SubmitMatchVotesInput
): Promise<ActionResult<{ savedCount: number }>> {
  let voter;
  try {
    voter = assertAuthenticatedPlayer(session);
  } catch (err) {
    return authErrorResult(err);
  }

  if (!client) return unconfiguredResult();

  const matchRow = await resolveMatchRow(client, input.matchId);
  if (!matchRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "No se encontró el partido indicado.",
    };
  }

  if (matchRow.voting_status !== "open") {
    return {
      ok: false,
      code: "CONFLICT",
      error: "La votación de este partido ya está cerrada.",
    };
  }

  const rosterRes = await client
    .from("match_players")
    .select("player_id")
    .eq("match_id", matchRow.id);

  if (rosterRes.error || !Array.isArray(rosterRes.data)) {
    return dbErrorResult(
      rosterRes.error ?? { message: "No se pudo verificar la nómina del partido." },
      "No se pudo verificar la nómina del partido."
    );
  }

  const participantUuids = new Set<string>(
    (rosterRes.data as Array<{ player_id: string }>).map((r) => r.player_id)
  );

  // Map slug -> UUID for participants so callers can pass domain slugs or UUIDs
  const playersRes = await client
    .from("players")
    .select("id, slug")
    .in("id", Array.from(participantUuids));

  const slugToUuid = new Map<string, string>();
  if (!playersRes.error && Array.isArray(playersRes.data)) {
    for (const p of playersRes.data as Array<{ id: string; slug: string | null }>) {
      slugToUuid.set(p.id, p.id);
      if (p.slug) slugToUuid.set(p.slug, p.id);
    }
  } else {
    for (const uuid of participantUuids) {
      slugToUuid.set(uuid, uuid);
    }
  }

  const normalizedInputEntries = (input.entries ?? []).map((entry) => ({
    ...entry,
    targetPlayerId: slugToUuid.get(entry.targetPlayerId) ?? entry.targetPlayerId,
  }));

  const validation = validateMatchBallot({
    voterPlayerId: voter.playerUuid,
    participantIds: participantUuids,
    entries: normalizedInputEntries,
  });

  if (!validation.ok) {
    return {
      ok: false,
      code: "VALIDATION",
      error: validation.error,
    };
  }

  const resetMvpRes = await client
    .from("match_votes")
    .update({ voted_mvp: false })
    .eq("match_id", matchRow.id)
    .eq("voter_player_id", voter.playerUuid)
    .eq("voted_mvp", true);

  if (resetMvpRes.error) {
    return dbErrorResult(
      resetMvpRes.error,
      "No se pudo actualizar tu voto de MVP."
    );
  }

  const rowsToUpsert = validation.entries.map((entry) => ({
    match_id: matchRow.id,
    voter_player_id: voter.playerUuid,
    target_player_id: entry.targetPlayerId,
    rating: entry.rating,
    voted_mvp: entry.votedMvp,
  }));

  const upsertRes = await client
    .from("match_votes")
    .upsert(rowsToUpsert, {
      onConflict: "match_id,voter_player_id,target_player_id",
    });

  if (upsertRes.error) {
    return dbErrorResult(upsertRes.error, "No se pudo registrar tu voto.");
  }

  return {
    ok: true,
    message: "Tu votación fue guardada. Podés ajustarla mientras siga abierta.",
    data: { savedCount: rowsToUpsert.length },
  };
}
