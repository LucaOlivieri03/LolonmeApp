import "server-only";
import {
  assertAuthenticatedPlayer,
  isAuthError,
  type ViewerSession,
} from "@/server/auth";
import type {
  ActionResult,
  SaveTacticalPositionsInput,
} from "@/lib/types/admin-actions";
import { clampTokenPosition } from "@/lib/matches/tactical-board";
import type { AdminDbClient, DbErrorLike } from "./mutations-core";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unconfiguredResult(): ActionResult<never> {
  return {
    ok: false,
    code: "UNCONFIGURED",
    error:
      "Supabase no está configurado en este entorno. Conectá la base de datos para guardar la formación.",
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
      error: "No tenés permisos para guardar la formación de este equipo.",
    };
  }
  console.error(
    `[tactical] Database error (${err.code ?? "unknown"}):`,
    err.message
  );
  return {
    ok: false,
    code: "INTERNAL",
    error: fallbackMessage,
  };
}

export async function performSaveTacticalPositions(
  client: AdminDbClient | null,
  session: ViewerSession,
  input: SaveTacticalPositionsInput
): Promise<ActionResult<{ updatedCount: number }>> {
  let actor;
  try {
    actor = assertAuthenticatedPlayer(session);
  } catch (err) {
    return authErrorResult(err);
  }

  if (!client) return unconfiguredResult();

  const matchIdOrSlug = input.matchId?.trim() ?? "";
  if (!matchIdOrSlug) {
    return { ok: false, code: "VALIDATION", error: "Falta el ID del partido." };
  }

  if (!Array.isArray(input.positions) || input.positions.length === 0) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "No se recibieron posiciones para guardar.",
    };
  }

  const matchCol = UUID_REGEX.test(matchIdOrSlug) ? "id" : "slug";
  const matchRes = await client
    .from("matches")
    .select("id")
    .eq(matchCol, matchIdOrSlug)
    .maybeSingle();

  const matchRow = matchRes.data as { id?: string } | null;
  if (matchRes.error || !matchRow?.id) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "No se encontró el partido indicado.",
    };
  }

  const rosterRes = await client
    .from("match_players")
    .select("id, player_id, team, is_cup_captain")
    .eq("match_id", matchRow.id);

  if (rosterRes.error || !Array.isArray(rosterRes.data)) {
    return dbErrorResult(
      rosterRes.error ?? { message: "No se pudo leer la nómina del partido." },
      "No se pudo leer la nómina del partido."
    );
  }

  const rosterRows = rosterRes.data as Array<{
    id: string;
    player_id: string;
    team: "A" | "B";
    is_cup_captain: boolean;
  }>;

  const isOperator = actor.role === "admin" || actor.role === "authorized";
  const allowedTeams = new Set<"A" | "B">();

  if (isOperator) {
    allowedTeams.add("A");
    allowedTeams.add("B");
  } else {
    for (const row of rosterRows) {
      if (row.player_id === actor.playerUuid && row.is_cup_captain) {
        allowedTeams.add(row.team);
      }
    }
  }

  if (allowedTeams.size === 0) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error:
        "Solo el Admin, un Autorizado o el Capitán del equipo puede guardar la formación oficial.",
    };
  }

  const rosterByPlayerUuid = new Map(rosterRows.map((r) => [r.player_id, r]));
  const playersRes = await client
    .from("players")
    .select("id, slug")
    .in(
      "id",
      rosterRows.map((r) => r.player_id)
    );

  const slugToUuid = new Map<string, string>();
  if (!playersRes.error && Array.isArray(playersRes.data)) {
    for (const p of playersRes.data as Array<{ id: string; slug: string | null }>) {
      slugToUuid.set(p.id, p.id);
      if (p.slug) slugToUuid.set(p.slug, p.id);
    }
  } else {
    for (const r of rosterRows) {
      slugToUuid.set(r.player_id, r.player_id);
    }
  }

  const updates: Array<{
    matchPlayerId: string;
    x: number;
    y: number;
  }> = [];

  for (const pos of input.positions) {
    const rawPlayerId = typeof pos.playerId === "string" ? pos.playerId.trim() : "";
    const resolvedUuid = slugToUuid.get(rawPlayerId) ?? rawPlayerId;
    const rosterRow = rosterByPlayerUuid.get(resolvedUuid);

    if (!rosterRow) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Uno de los jugadores no pertenece a este partido.",
      };
    }

    if (!allowedTeams.has(rosterRow.team)) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: `Como capitán solo podés guardar las posiciones de tu equipo (Equipo ${Array.from(allowedTeams).join(", ")}).`,
      };
    }

    const numX = Number(pos.x);
    const numY = Number(pos.y);
    if (!Number.isFinite(numX) || !Number.isFinite(numY)) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Coordenadas inválidas para la pizarra.",
      };
    }

    const clamped = clampTokenPosition(rosterRow.team, numX, numY);
    updates.push({
      matchPlayerId: rosterRow.id,
      x: clamped.x,
      y: clamped.y,
    });
  }

  for (const item of updates) {
    const res = await client
      .from("match_players")
      .update({ pitch_x: item.x, pitch_y: item.y })
      .eq("id", item.matchPlayerId);

    if (res.error) {
      return dbErrorResult(res.error, "No se pudo guardar la formación.");
    }
  }

  return {
    ok: true,
    message: isOperator
      ? "Formación oficial guardada para todos."
      : `Formación oficial del Equipo ${Array.from(allowedTeams).join("/")} guardada.`,
    data: { updatedCount: updates.length },
  };
}
