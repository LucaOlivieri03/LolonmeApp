import "server-only";
import { randomUUID } from "crypto";
import { computeStandings, generateCupBracket } from "@/lib/engine";
import type {
  CalendarEventType,
  CupRound,
  MatchModality,
  MatchType,
  PlayerRole,
  TitleType,
} from "@/lib/types/domain";
import {
  assertAdmin,
  assertOperator,
  isAuthError,
  type ViewerSession,
} from "@/server/auth";
import type { PublicTournamentRepository } from "@/server/repositories";
import type {
  ActionResult,
  AwardPlayerTitleInput,
  CreateAnnouncementInput,
  CreateCalendarEventInput,
  CreateMatchInput,
  CreatePlayerInput,
  CreateSeasonInput,
  DeleteAnnouncementInput,
  DeleteCalendarEventInput,
  DeleteMatchInput,
  MatchRosterEntryInput,
  RegenerateCupBracketInput,
  UpdateCupTieInput,
  UpdateMatchInput,
  UpdatePlayerRoleInput,
} from "@/lib/types/admin-actions";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_MATCH_TYPES = new Set<MatchType>([
  "league",
  "cup",
  "lolonmebol",
  "special_f11",
  "league_tiebreaker",
]);
const VALID_MODALITIES = new Set<MatchModality>(["F5", "F6", "F7", "F11"]);
const VALID_RESULT_OUTCOMES = new Set(["A", "B", "draw"]);
const VALID_EVENT_TYPES = new Set<CalendarEventType>([
  "league",
  "cup",
  "lolonmebol",
  "special_f11",
  "rest",
  "postponed",
]);
const VALID_PLAYER_ROLES = new Set<Exclude<PlayerRole, "guest">>([
  "admin",
  "authorized",
  "player",
]);
const VALID_TITLE_TYPES = new Set<TitleType>(["league", "cup", "lolonmebol"]);

const ROUND_BY_CODE: Record<string, CupRound> = {
  prelim: "preliminary",
  qf: "quarterfinal",
  sf: "semifinal",
  final: "final",
  lolonmebol: "lolonmebol",
};

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Minimal structural type compatible with @supabase/supabase-js Postgrest query builder
export interface DbErrorLike {
  message: string;
  code?: string;
}

export interface DbQueryResult<T = unknown> {
  data: T | null;
  error: DbErrorLike | null;
}

export interface DbQueryBuilder {
  select(columns?: string): DbQueryBuilder;
  insert(
    values: Record<string, unknown> | Record<string, unknown>[]
  ): DbQueryBuilder;
  update(values: Record<string, unknown>): DbQueryBuilder;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ): DbQueryBuilder;
  delete(): DbQueryBuilder;
  eq(column: string, value: unknown): DbQueryBuilder;
  neq(column: string, value: unknown): DbQueryBuilder;
  in(column: string, values: unknown[]): DbQueryBuilder;
  maybeSingle(): Promise<DbQueryResult>;
  single(): Promise<DbQueryResult>;
  then<TResult1 = DbQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: DbQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

export interface AdminDbClient {
  from(table: string): DbQueryBuilder;
}

export function slugifyIdentifier(raw: string): string {
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "item";
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isNonNegativeInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function guardErrorToResult(err: unknown): ActionResult<never> {
  if (isAuthError(err)) {
    return { ok: false, code: err.code, error: err.message };
  }
  const message =
    err instanceof Error ? err.message : "Error inesperado en el servidor.";
  return { ok: false, code: "INTERNAL", error: message };
}

function unconfiguredResult(): ActionResult<never> {
  return {
    ok: false,
    code: "UNCONFIGURED",
    error: "Supabase no está configurado en el servidor.",
  };
}

function dbErrorResult(
  err: DbErrorLike,
  fallbackMessage: string
): ActionResult<never> {
  if (err.code === "23505") {
    return {
      ok: false,
      code: "CONFLICT",
      error: `${fallbackMessage} (registro duplicado).`,
    };
  }
  if (err.code === "42501") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Permisos insuficientes en la base de datos.",
    };
  }
  return {
    ok: false,
    code: "INTERNAL",
    error: `${fallbackMessage}: ${err.message}`,
  };
}

async function resolveSeasonRow(
  db: AdminDbClient,
  seasonId: string
): Promise<{ id: string; year: number } | null> {
  const trimmed = seasonId.trim();
  if (!trimmed) return null;

  if (UUID_REGEX.test(trimmed)) {
    const { data, error } = await db
      .from("seasons")
      .select("id, year")
      .eq("id", trimmed)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: string; year: number };
  }

  const seasonYearMatch = /^season-(\d{4})$/.exec(trimmed);
  if (seasonYearMatch) {
    const year = Number(seasonYearMatch[1]);
    const { data, error } = await db
      .from("seasons")
      .select("id, year")
      .eq("year", year)
      .maybeSingle();
    if (error || !data) return null;
    return data as { id: string; year: number };
  }

  return null;
}

async function resolvePlayerUuid(
  db: AdminDbClient,
  playerId: string
): Promise<string | null> {
  const trimmed = playerId.trim();
  if (!trimmed) return null;

  const column = UUID_REGEX.test(trimmed) ? "id" : "slug";
  const { data, error } = await db
    .from("players")
    .select("id")
    .eq(column, trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function resolvePlayerUuidMap(
  db: AdminDbClient,
  playerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(
    new Set(playerIds.map((id) => id.trim()).filter(Boolean))
  );
  if (unique.length === 0) return map;

  const uuids = unique.filter((id) => UUID_REGEX.test(id));
  const slugs = unique.filter((id) => !UUID_REGEX.test(id));

  if (uuids.length > 0) {
    const { data } = await db
      .from("players")
      .select("id, slug")
      .in("id", uuids);
    for (const row of (data as Array<{ id: string; slug: string }> | null) ??
      []) {
      map.set(row.id, row.id);
      if (row.slug) map.set(row.slug, row.id);
    }
  }

  if (slugs.length > 0) {
    const { data } = await db
      .from("players")
      .select("id, slug")
      .in("slug", slugs);
    for (const row of (data as Array<{ id: string; slug: string }> | null) ??
      []) {
      map.set(row.slug, row.id);
      map.set(row.id, row.id);
    }
  }

  return map;
}

async function resolveMatchUuid(
  db: AdminDbClient,
  matchId: string
): Promise<string | null> {
  const trimmed = matchId.trim();
  if (!trimmed) return null;

  const column = UUID_REGEX.test(trimmed) ? "id" : "slug";
  const { data, error } = await db
    .from("matches")
    .select("id")
    .eq(column, trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function resolveByExternalKeyOrId(
  db: AdminDbClient,
  table: "announcements" | "calendar_events",
  idOrKey: string
): Promise<string | null> {
  const trimmed = idOrKey.trim();
  if (!trimmed) return null;

  const column = UUID_REGEX.test(trimmed) ? "id" : "external_key";
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq(column, trimmed)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function resolveCupTieUuid(
  db: AdminDbClient,
  tieId: string
): Promise<string | null> {
  const trimmed = tieId.trim();
  if (!trimmed) return null;

  if (UUID_REGEX.test(trimmed)) {
    const { data, error } = await db
      .from("cup_ties")
      .select("id")
      .eq("id", trimmed)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { id: string }).id;
  }

  const parsed = /^cup-(\d{4})-(prelim|qf|sf|final|lolonmebol)-(\d+)$/.exec(
    trimmed
  );
  if (!parsed) return null;

  const year = Number(parsed[1]);
  const round = ROUND_BY_CODE[parsed[2]];
  const slotOrder = Number(parsed[3]);
  if (!round || !Number.isInteger(slotOrder)) return null;

  const season = await resolveSeasonRow(db, `season-${year}`);
  if (!season) return null;

  const { data: edition, error: edErr } = await db
    .from("cup_editions")
    .select("id")
    .eq("season_id", season.id)
    .maybeSingle();
  if (edErr || !edition) return null;

  const { data: tie, error: tieErr } = await db
    .from("cup_ties")
    .select("id")
    .eq("cup_edition_id", (edition as { id: string }).id)
    .eq("round", round)
    .eq("slot_order", slotOrder)
    .maybeSingle();
  if (tieErr || !tie) return null;
  return (tie as { id: string }).id;
}

function validateMatchInput(
  input: CreateMatchInput
): { ok: true; computedOutcome: "A" | "B" | "draw" | null } | { ok: false; error: string } {
  if (!VALID_MATCH_TYPES.has(input.matchType)) {
    return { ok: false, error: "Tipo de partido inválido." };
  }
  if (!VALID_MODALITIES.has(input.modality)) {
    return { ok: false, error: "Modalidad inválida." };
  }
  if (!isValidIsoDate(input.matchDate)) {
    return { ok: false, error: "Fecha de partido inválida (YYYY-MM-DD)." };
  }
  if (
    input.matchNumber !== null &&
    (!isNonNegativeInt(input.matchNumber) || input.matchNumber < 1)
  ) {
    return { ok: false, error: "Número de partido inválido." };
  }
  if (input.teamAScore !== null && !isNonNegativeInt(input.teamAScore)) {
    return { ok: false, error: "Goles del Equipo A inválidos." };
  }
  if (input.teamBScore !== null && !isNonNegativeInt(input.teamBScore)) {
    return { ok: false, error: "Goles del Equipo B inválidos." };
  }
  if (
    (input.teamAScore === null) !== (input.teamBScore === null)
  ) {
    return {
      ok: false,
      error: "Completá ambos marcadores o dejá ambos vacíos.",
    };
  }
  if (
    input.resultOutcome !== undefined &&
    input.resultOutcome !== null &&
    !VALID_RESULT_OUTCOMES.has(input.resultOutcome)
  ) {
    return { ok: false, error: "Resultado de partido inválido." };
  }

  if (!Array.isArray(input.roster) || input.roster.length === 0) {
    return {
      ok: false,
      error: "El partido debe tener al menos un jugador en el plantel.",
    };
  }

  const seenPlayers = new Set<string>();
  let countA = 0;
  let countB = 0;
  for (const entry of input.roster) {
    const pid = entry.playerId?.trim();
    if (!pid) {
      return { ok: false, error: "Jugador inválido en el plantel." };
    }
    if (seenPlayers.has(pid)) {
      return {
        ok: false,
        error: "Un jugador no puede repetirse en el mismo partido.",
      };
    }
    seenPlayers.add(pid);

    if (entry.team !== "A" && entry.team !== "B") {
      return { ok: false, error: "Equipo inválido en el plantel." };
    }
    if (entry.team === "A") countA += 1;
    else countB += 1;

    if (entry.goals !== undefined && !isNonNegativeInt(entry.goals)) {
      return { ok: false, error: "Cantidad de goles de jugador inválida." };
    }
    if (entry.assists !== undefined && !isNonNegativeInt(entry.assists)) {
      return { ok: false, error: "Cantidad de asistencias inválida." };
    }
    if (
      entry.adminRating !== undefined &&
      entry.adminRating !== null &&
      (typeof entry.adminRating !== "number" ||
        !Number.isFinite(entry.adminRating) ||
        entry.adminRating < 0 ||
        entry.adminRating > 10)
    ) {
      return {
        ok: false,
        error: "El puntaje del admin debe estar entre 0 y 10.",
      };
    }
  }

  if (countA === 0 || countB === 0) {
    return {
      ok: false,
      error: "Ambos equipos (A y B) deben tener al menos un jugador.",
    };
  }

  let computedOutcome: "A" | "B" | "draw" | null = input.resultOutcome ?? null;
  if (input.teamAScore !== null && input.teamBScore !== null) {
    computedOutcome =
      input.teamAScore > input.teamBScore
        ? "A"
        : input.teamBScore > input.teamAScore
          ? "B"
          : "draw";
  }

  return { ok: true, computedOutcome };
}

function buildMatchPlayerRows(
  matchUuid: string,
  roster: MatchRosterEntryInput[],
  playerUuidMap: Map<string, string>
): Array<Record<string, unknown>> {
  return roster.map((entry) => ({
    match_id: matchUuid,
    player_id: playerUuidMap.get(entry.playerId.trim())!,
    team: entry.team,
    is_cup_captain: Boolean(entry.isCupCaptain),
    goals: entry.goals ?? 0,
    assists: entry.assists ?? 0,
    admin_rating: entry.adminRating ?? null,
    is_mvp: Boolean(entry.isMvp),
  }));
}

async function generateUniqueMatchSlug(
  db: AdminDbClient,
  year: number,
  matchNumber: number | null,
  matchDate: string
): Promise<string> {
  const base =
    matchNumber !== null
      ? `match-${year}-${matchNumber}-${matchDate}`
      : `match-${year}-${matchDate}`;

  const { data: existing } = await db
    .from("matches")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();

  if (!existing) return base;
  return `${base}-${randomUUID().slice(0, 8)}`;
}

async function generateUniquePlayerSlug(
  db: AdminDbClient,
  displayName: string
): Promise<string> {
  const base = slugifyIdentifier(displayName);
  const { data: existing } = await db
    .from("players")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();
  if (!existing) return base;
  return `${base}-${randomUUID().slice(0, 6)}`;
}

// ---------------------------------------------------------------------------
// Matches (create/delete = Operator; full edit = Admin)
// ---------------------------------------------------------------------------

export async function performCreateMatch(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: CreateMatchInput
): Promise<ActionResult<{ id: string }>> {
  try {
    assertOperator(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const validation = validateMatchInput(input);
  if (!validation.ok) {
    return { ok: false, code: "VALIDATION", error: validation.error };
  }

  const season = await resolveSeasonRow(db, input.seasonId);
  if (!season) {
    return { ok: false, code: "NOT_FOUND", error: "Temporada no encontrada." };
  }

  const playerUuidMap = await resolvePlayerUuidMap(
    db,
    input.roster.map((r) => r.playerId)
  );
  const missingPlayer = input.roster.find(
    (r) => !playerUuidMap.has(r.playerId.trim())
  );
  if (missingPlayer) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: `Jugador no encontrado en el padrón: ${missingPlayer.playerId}`,
    };
  }

  const slug = await generateUniqueMatchSlug(
    db,
    season.year,
    input.matchNumber,
    input.matchDate
  );

  const { data: insertedMatch, error: matchErr } = await db
    .from("matches")
    .insert({
      season_id: season.id,
      slug,
      match_number: input.matchNumber,
      match_date: input.matchDate,
      match_type: input.matchType,
      modality: input.modality,
      team_a_score: input.teamAScore,
      team_b_score: input.teamBScore,
      result_outcome: validation.computedOutcome,
      counts_for_league: input.countsForLeague,
      counts_for_stats:
        input.countsForStats ?? input.matchType !== "special_f11",
      voting_status: "closed",
      notes: input.notes?.trim() || null,
    })
    .select("id, slug")
    .single();

  if (matchErr || !insertedMatch) {
    return dbErrorResult(
      matchErr ?? { message: "No se pudo insertar el partido" },
      "No se pudo guardar el partido"
    );
  }

  const matchRow = insertedMatch as { id: string; slug: string };
  const rosterRows = buildMatchPlayerRows(
    matchRow.id,
    input.roster,
    playerUuidMap
  );

  const { error: rosterErr } = await db
    .from("match_players")
    .insert(rosterRows);

  if (rosterErr) {
    // Compensating rollback so we never leave an orphan match without players
    await db.from("matches").delete().eq("id", matchRow.id);
    return dbErrorResult(
      rosterErr,
      "No se pudo guardar el plantel del partido (se revirtió la carga)"
    );
  }

  return {
    ok: true,
    message: "Partido cargado y tablas recalculadas.",
    data: { id: matchRow.slug },
  };
}

export async function performUpdateMatch(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: UpdateMatchInput
): Promise<ActionResult<{ id: string }>> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const validation = validateMatchInput(input);
  if (!validation.ok) {
    return { ok: false, code: "VALIDATION", error: validation.error };
  }

  const matchUuid = await resolveMatchUuid(db, input.matchId);
  if (!matchUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Partido no encontrado." };
  }

  const season = await resolveSeasonRow(db, input.seasonId);
  if (!season) {
    return { ok: false, code: "NOT_FOUND", error: "Temporada no encontrada." };
  }

  const playerUuidMap = await resolvePlayerUuidMap(
    db,
    input.roster.map((r) => r.playerId)
  );
  const missingPlayer = input.roster.find(
    (r) => !playerUuidMap.has(r.playerId.trim())
  );
  if (missingPlayer) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: `Jugador no encontrado en el padrón: ${missingPlayer.playerId}`,
    };
  }

  const resolvedUuids = new Set<string>();
  for (const entry of input.roster) {
    const uuid = playerUuidMap.get(entry.playerId.trim())!;
    if (resolvedUuids.has(uuid)) {
      return {
        ok: false,
        code: "VALIDATION",
        error: "Un jugador no puede repetirse en el mismo partido.",
      };
    }
    resolvedUuids.add(uuid);
  }

  // Snapshot current state for compensating rollback
  const { data: prevMatch, error: prevMatchErr } = await db
    .from("matches")
    .select(
      "id, slug, season_id, match_number, match_date, match_type, modality, team_a_score, team_b_score, result_outcome, counts_for_league, counts_for_stats, notes"
    )
    .eq("id", matchUuid)
    .maybeSingle();

  if (prevMatchErr || !prevMatch) {
    return dbErrorResult(
      prevMatchErr ?? { message: "No se pudo leer el estado actual del partido" },
      "No se pudo leer el partido antes de editarlo"
    );
  }

  const { data: prevRoster, error: prevRosterErr } = await db
    .from("match_players")
    .select(
      "match_id, player_id, team, is_cup_captain, goals, assists, admin_rating, is_mvp"
    )
    .eq("match_id", matchUuid);

  if (prevRosterErr) {
    return dbErrorResult(
      prevRosterErr,
      "No se pudo leer el plantel actual del partido antes de editarlo"
    );
  }

  const prevRosterRows =
    (prevRoster as Array<Record<string, unknown>> | null) ?? [];
  const prevPlayerUuids = new Set(
    prevRosterRows.map((row) => String(row.player_id))
  );

  const { error: updateErr } = await db
    .from("matches")
    .update({
      season_id: season.id,
      match_number: input.matchNumber,
      match_date: input.matchDate,
      match_type: input.matchType,
      modality: input.modality,
      team_a_score: input.teamAScore,
      team_b_score: input.teamBScore,
      result_outcome: validation.computedOutcome,
      counts_for_league: input.countsForLeague,
      counts_for_stats:
        input.countsForStats ?? input.matchType !== "special_f11",
      notes: input.notes?.trim() || null,
    })
    .eq("id", matchUuid);

  if (updateErr) {
    return dbErrorResult(updateErr, "No se pudo actualizar el partido");
  }

  const nextRosterRows = buildMatchPlayerRows(
    matchUuid,
    input.roster,
    playerUuidMap
  );
  const nextPlayerUuids = new Set(
    nextRosterRows.map((row) => String(row.player_id))
  );
  const addedPlayerUuids = nextRosterRows
    .map((row) => String(row.player_id))
    .filter((pid) => !prevPlayerUuids.has(pid));
  const removedPlayerUuids = prevRosterRows
    .map((row) => String(row.player_id))
    .filter((pid) => !nextPlayerUuids.has(pid));

  const { error: upsertErr } = await db
    .from("match_players")
    .upsert(nextRosterRows, { onConflict: "match_id,player_id" });

  if (upsertErr) {
    const { id: _id, slug: _slug, ...restoreFields } = prevMatch as Record<
      string,
      unknown
    >;
    void _id;
    void _slug;
    await db.from("matches").update(restoreFields).eq("id", matchUuid);
    return dbErrorResult(
      upsertErr,
      "No se pudo actualizar el plantel del partido"
    );
  }

  if (removedPlayerUuids.length > 0) {
    const { error: delErr } = await db
      .from("match_players")
      .delete()
      .eq("match_id", matchUuid)
      .in("player_id", removedPlayerUuids);

    if (delErr) {
      // Compensating restore: remove newly added players, restore previous match and roster
      if (addedPlayerUuids.length > 0) {
        await db
          .from("match_players")
          .delete()
          .eq("match_id", matchUuid)
          .in("player_id", addedPlayerUuids);
      }
      const { id: _id, slug: _slug, ...restoreFields } = prevMatch as Record<
        string,
        unknown
      >;
      void _id;
      void _slug;
      await db.from("matches").update(restoreFields).eq("id", matchUuid);
      if (prevRosterRows.length > 0) {
        await db
          .from("match_players")
          .upsert(prevRosterRows, { onConflict: "match_id,player_id" });
      }
      return dbErrorResult(
        delErr,
        "No se pudieron quitar los jugadores removidos del partido"
      );
    }
  }

  return {
    ok: true,
    message: "Partido actualizado y tablas recalculadas.",
    data: { id: (prevMatch as { slug?: string } | null)?.slug ?? input.matchId },
  };
}

export async function performDeleteMatch(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: DeleteMatchInput
): Promise<ActionResult> {
  try {
    assertOperator(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const matchUuid = await resolveMatchUuid(db, input.matchId);
  if (!matchUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Partido no encontrado." };
  }

  const { error } = await db.from("matches").delete().eq("id", matchUuid);
  if (error) {
    return dbErrorResult(error, "No se pudo eliminar el partido");
  }

  return { ok: true, message: "Partido eliminado." };
}

// ---------------------------------------------------------------------------
// Community: Announcements & Calendar Events (Operator)
// ---------------------------------------------------------------------------

export async function performCreateAnnouncement(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: CreateAnnouncementInput
): Promise<ActionResult<{ id: string }>> {
  try {
    assertOperator(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const title = input.title?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!title || !body) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Completá título y contenido del anuncio.",
    };
  }

  const externalKey = `ann-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const { error } = await db.from("announcements").insert({
    title,
    body,
    is_pinned: Boolean(input.isPinned),
    created_by: session.playerUuid,
    external_key: externalKey,
  });

  if (error) {
    return dbErrorResult(error, "No se pudo publicar el anuncio");
  }

  return {
    ok: true,
    message: "Anuncio publicado.",
    data: { id: externalKey },
  };
}

export async function performDeleteAnnouncement(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: DeleteAnnouncementInput
): Promise<ActionResult> {
  try {
    assertOperator(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const annUuid = await resolveByExternalKeyOrId(
    db,
    "announcements",
    input.announcementId
  );
  if (!annUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Anuncio no encontrado." };
  }

  const { error } = await db.from("announcements").delete().eq("id", annUuid);
  if (error) {
    return dbErrorResult(error, "No se pudo eliminar el anuncio");
  }

  return { ok: true, message: "Anuncio eliminado." };
}

export async function performCreateCalendarEvent(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: CreateCalendarEventInput
): Promise<ActionResult<{ id: string }>> {
  try {
    assertOperator(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const title = input.title?.trim() ?? "";
  if (!title) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Completá el título del evento.",
    };
  }
  if (!isValidIsoDate(input.eventDate)) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Fecha del evento inválida (YYYY-MM-DD).",
    };
  }
  if (!VALID_EVENT_TYPES.has(input.eventType)) {
    return { ok: false, code: "VALIDATION", error: "Tipo de evento inválido." };
  }

  const season = await resolveSeasonRow(db, input.seasonId);
  if (!season) {
    return { ok: false, code: "NOT_FOUND", error: "Temporada no encontrada." };
  }

  let matchUuid: string | null = null;
  if (input.matchId) {
    matchUuid = await resolveMatchUuid(db, input.matchId);
    if (!matchUuid) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "Partido vinculado no encontrado.",
      };
    }
  }

  const externalKey = `ev-${season.year}-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const { error } = await db.from("calendar_events").insert({
    season_id: season.id,
    title,
    description: input.description?.trim() || null,
    event_date: input.eventDate,
    event_type: input.eventType,
    match_id: matchUuid,
    created_by: session.playerUuid,
    external_key: externalKey,
  });

  if (error) {
    return dbErrorResult(error, "No se pudo agregar el evento al calendario");
  }

  return {
    ok: true,
    message: "Evento agregado al calendario.",
    data: { id: externalKey },
  };
}

export async function performDeleteCalendarEvent(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: DeleteCalendarEventInput
): Promise<ActionResult> {
  try {
    assertOperator(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const evUuid = await resolveByExternalKeyOrId(
    db,
    "calendar_events",
    input.eventId
  );
  if (!evUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Evento no encontrado." };
  }

  const { error } = await db
    .from("calendar_events")
    .delete()
    .eq("id", evUuid);
  if (error) {
    return dbErrorResult(error, "No se pudo eliminar el evento");
  }

  return { ok: true, message: "Evento eliminado." };
}

// ---------------------------------------------------------------------------
// Players, Titles & Seasons (Admin-only)
// ---------------------------------------------------------------------------

export async function performCreatePlayer(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: CreatePlayerInput
): Promise<ActionResult<{ id: string }>> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const displayName = input.displayName?.trim() ?? "";
  if (!displayName) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Ingresá el nombre del jugador.",
    };
  }
  if (!VALID_PLAYER_ROLES.has(input.role)) {
    return { ok: false, code: "VALIDATION", error: "Rol inválido." };
  }

  const email = input.email?.trim().toLowerCase() || null;
  if (email && !EMAIL_REGEX.test(email)) {
    return { ok: false, code: "VALIDATION", error: "Email inválido." };
  }

  const slug = await generateUniquePlayerSlug(db, displayName);
  const { data, error } = await db
    .from("players")
    .insert({
      display_name: displayName,
      slug,
      email,
      role: input.role,
      is_active: true,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return dbErrorResult(
      error ?? { message: "No se pudo crear el jugador" },
      "No se pudo agregar el jugador"
    );
  }

  return {
    ok: true,
    message: `Jugador "${displayName}" agregado al padrón.`,
    data: { id: (data as { slug: string }).slug },
  };
}

export async function performUpdatePlayerRole(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: UpdatePlayerRoleInput
): Promise<ActionResult> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  if (!VALID_PLAYER_ROLES.has(input.role)) {
    return { ok: false, code: "VALIDATION", error: "Rol inválido." };
  }

  const playerUuid = await resolvePlayerUuid(db, input.playerId);
  if (!playerUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Jugador no encontrado." };
  }

  if (session.playerUuid && session.playerUuid === playerUuid && input.role !== "admin") {
    return {
      ok: false,
      code: "VALIDATION",
      error: "No podés quitarte el rol de administrador a vos mismo.",
    };
  }

  const { error } = await db
    .from("players")
    .update({ role: input.role })
    .eq("id", playerUuid);

  if (error) {
    return dbErrorResult(error, "No se pudo actualizar el rol del jugador");
  }

  return { ok: true, message: "Rol actualizado." };
}

export async function performAwardPlayerTitle(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: AwardPlayerTitleInput
): Promise<ActionResult> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  if (!VALID_TITLE_TYPES.has(input.titleType)) {
    return { ok: false, code: "VALIDATION", error: "Tipo de título inválido." };
  }

  const playerUuid = await resolvePlayerUuid(db, input.playerId);
  if (!playerUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Jugador no encontrado." };
  }

  const season = await resolveSeasonRow(db, input.seasonId);
  if (!season) {
    return { ok: false, code: "NOT_FOUND", error: "Temporada no encontrada." };
  }

  const awardedAt = new Date().toISOString().slice(0, 10);
  const { error } = await db.from("player_titles").insert({
    player_id: playerUuid,
    season_id: season.id,
    title_type: input.titleType,
    awarded_at: awardedAt,
  });

  if (error) {
    return dbErrorResult(
      error,
      "No se pudo otorgar el título (quizás ya lo posee en esa temporada)"
    );
  }

  return { ok: true, message: "Estrella otorgada correctamente." };
}

export async function performCreateSeason(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: CreateSeasonInput
): Promise<ActionResult<{ id: string; year: number }>> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  if (
    !Number.isInteger(input.year) ||
    input.year < 2000 ||
    input.year > 2100
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Ingresá un año válido (2000 a 2100).",
    };
  }
  if (
    typeof input.defaultFee !== "number" ||
    !Number.isFinite(input.defaultFee) ||
    input.defaultFee < 0
  ) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "La cuota mensual debe ser un número mayor o igual a 0.",
    };
  }

  const cutoffDate = input.cupCutoffDate?.trim() || `${input.year}-08-01`;
  if (!isValidIsoDate(cutoffDate)) {
    return {
      ok: false,
      code: "VALIDATION",
      error: "Fecha de corte de Copa inválida (YYYY-MM-DD).",
    };
  }

  const { data: existingSeasons, error: listErr } = await db
    .from("seasons")
    .select("id, year, status");
  if (listErr) {
    return dbErrorResult(listErr, "No se pudieron consultar las temporadas");
  }

  const seasons =
    (existingSeasons as Array<{ id: string; year: number; status: string }> | null) ??
    [];
  if (seasons.some((s) => s.year === input.year)) {
    return {
      ok: false,
      code: "CONFLICT",
      error: `La temporada ${input.year} ya existe.`,
    };
  }

  const maxExistingYear = seasons.reduce(
    (max, s) => (s.year > max ? s.year : max),
    0
  );
  const isNewest = input.year >= maxExistingYear;
  const previousActiveIds = isNewest
    ? seasons.filter((s) => s.status === "active").map((s) => s.id)
    : [];

  const { data: createdSeason, error: seasonErr } = await db
    .from("seasons")
    .insert({
      year: input.year,
      name: `Temporada ${input.year}`,
      status: isNewest ? "active" : "finished",
      cup_cutoff_date: cutoffDate,
    })
    .select("id, year")
    .single();

  if (seasonErr || !createdSeason) {
    return dbErrorResult(
      seasonErr ?? { message: "No se pudo crear la temporada" },
      "No se pudo crear la temporada"
    );
  }

  const seasonUuid = (createdSeason as { id: string }).id;

  const { error: cupErr } = await db.from("cup_editions").insert({
    season_id: seasonUuid,
    name: `Copa LOLONMEBOL ${input.year}`,
    cutoff_snapshot_json: [],
  });

  if (cupErr) {
    await db.from("seasons").delete().eq("id", seasonUuid);
    return dbErrorResult(
      cupErr,
      "No se pudo inicializar la Copa de la temporada"
    );
  }

  const fundMonthRows = MONTH_LABELS.map((label, idx) => ({
    season_id: seasonUuid,
    month_number: idx + 1,
    month_label: label,
    fee_amount: input.defaultFee,
  }));

  const { error: fundErr } = await db.from("fund_months").insert(fundMonthRows);
  if (fundErr) {
    // Deleting the season cascades to cup_editions and fund_months
    await db.from("seasons").delete().eq("id", seasonUuid);
    return dbErrorResult(
      fundErr,
      "No se pudieron inicializar los meses del Pozo"
    );
  }

  if (previousActiveIds.length > 0) {
    await db
      .from("seasons")
      .update({ status: "finished" })
      .in("id", previousActiveIds);
  }

  return {
    ok: true,
    message: `Temporada ${input.year} creada con Copa y Pozo inicializados.`,
    data: { id: `season-${input.year}`, year: input.year },
  };
}

// ---------------------------------------------------------------------------
// Cup (Admin-only)
// ---------------------------------------------------------------------------

export async function performRegenerateCupBracket(
  db: AdminDbClient | null,
  session: ViewerSession,
  repo: PublicTournamentRepository,
  input: RegenerateCupBracketInput
): Promise<ActionResult> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const season = await resolveSeasonRow(db, input.seasonId);
  if (!season) {
    return { ok: false, code: "NOT_FOUND", error: "Temporada no encontrada." };
  }

  const publicData = await repo.getPublicDataset();
  const domainSeasonId = `season-${season.year}`;
  const standings = computeStandings({
    players: publicData.players,
    matches: publicData.matches,
    titles: publicData.titles,
    seasonId: domainSeasonId,
  });

  const standingsPlayerIds = standings.rows.map((r) => r.playerId);
  const finalists = input.previousFinalists.filter(Boolean);

  // Ensure cup_edition exists
  const { data: existingEdition, error: editionLookupErr } = await db
    .from("cup_editions")
    .select("id, cutoff_snapshot_json")
    .eq("season_id", season.id)
    .maybeSingle();

  if (editionLookupErr) {
    return dbErrorResult(
      editionLookupErr,
      "No se pudo consultar la edición de Copa"
    );
  }

  let edition = existingEdition;
  let createdEditionInThisCall = false;

  if (!edition) {
    const { data: createdEd, error: createEdErr } = await db
      .from("cup_editions")
      .insert({
        season_id: season.id,
        name: `Copa LOLONMEBOL ${season.year}`,
        cutoff_snapshot_json: [],
      })
      .select("id, cutoff_snapshot_json")
      .single();
    if (createEdErr || !createdEd) {
      return dbErrorResult(
        createEdErr ?? { message: "No se pudo crear la edición de Copa" },
        "No se pudo inicializar la edición de Copa"
      );
    }
    edition = createdEd;
    createdEditionInThisCall = true;
  }

  const editionUuid = (edition as { id: string }).id;
  const generatedTies = generateCupBracket({
    editionId: `cup-${season.year}`,
    standingsPlayerIds,
    previousLolonmebolFinalistIds: finalists,
  });

  const top9PlayerIds = standingsPlayerIds.slice(0, 9);
  const allPlayerIds = new Set<string>(top9PlayerIds);
  for (const tie of generatedTies) {
    if (tie.playerAId) allPlayerIds.add(tie.playerAId);
    if (tie.playerBId) allPlayerIds.add(tie.playerBId);
    if (tie.winnerPlayerId) allPlayerIds.add(tie.winnerPlayerId);
  }
  const playerUuidMap = await resolvePlayerUuidMap(
    db,
    Array.from(allPlayerIds)
  );
  const nextCutoffSnapshot = top9PlayerIds.map(
    (pid) => playerUuidMap.get(pid) ?? pid
  );

  // Snapshot existing ties for rollback (abort before mutating if read fails)
  const { data: prevTies, error: prevTiesErr } = await db
    .from("cup_ties")
    .select(
      "cup_edition_id, round, slot_order, player_a_id, player_b_id, seed_a, seed_b, leg1_match_id, leg2_match_id, override_score_a, override_score_b, winner_player_id, notes"
    )
    .eq("cup_edition_id", editionUuid);

  if (prevTiesErr) {
    return dbErrorResult(
      prevTiesErr,
      "No se pudieron leer las llaves actuales de la Copa"
    );
  }

  const prevTieRows = (prevTies as Array<Record<string, unknown>> | null) ?? [];

  const { error: delErr } = await db
    .from("cup_ties")
    .delete()
    .eq("cup_edition_id", editionUuid);
  if (delErr) {
    return dbErrorResult(delErr, "No se pudieron reemplazar las llaves previas");
  }

  const nextTieRows = generatedTies.map((tie) => ({
    cup_edition_id: editionUuid,
    round: tie.round,
    slot_order: tie.slotOrder,
    player_a_id: tie.playerAId ? playerUuidMap.get(tie.playerAId) ?? null : null,
    player_b_id: tie.playerBId ? playerUuidMap.get(tie.playerBId) ?? null : null,
    seed_a: tie.seedA,
    seed_b: tie.seedB,
    leg1_match_id: null,
    leg2_match_id: null,
    override_score_a: tie.overrideScoreA,
    override_score_b: tie.overrideScoreB,
    winner_player_id: tie.winnerPlayerId
      ? playerUuidMap.get(tie.winnerPlayerId) ?? null
      : null,
    notes: tie.notes ?? null,
  }));

  const { error: insertErr } = await db.from("cup_ties").insert(nextTieRows);
  if (insertErr) {
    if (prevTieRows.length > 0) {
      await db.from("cup_ties").insert(prevTieRows);
    } else if (createdEditionInThisCall) {
      await db.from("cup_editions").delete().eq("id", editionUuid);
    }
    return dbErrorResult(
      insertErr,
      "No se pudo guardar el nuevo cuadro de Copa (se restauró el anterior)"
    );
  }

  // Update cutoff snapshot only after cup_ties replacement has succeeded
  const { error: edUpdateErr } = await db
    .from("cup_editions")
    .update({ cutoff_snapshot_json: nextCutoffSnapshot })
    .eq("id", editionUuid);
  if (edUpdateErr) {
    await db.from("cup_ties").delete().eq("cup_edition_id", editionUuid);
    if (prevTieRows.length > 0) {
      await db.from("cup_ties").insert(prevTieRows);
    }
    return dbErrorResult(
      edUpdateErr,
      "No se pudo actualizar el corte de Copa (se restauró el cuadro anterior)"
    );
  }

  return {
    ok: true,
    message: `Cuadro de Copa ${season.year} regenerado.`,
  };
}

export async function performUpdateCupTie(
  db: AdminDbClient | null,
  session: ViewerSession,
  input: UpdateCupTieInput
): Promise<ActionResult> {
  try {
    assertAdmin(session);
  } catch (err) {
    return guardErrorToResult(err);
  }
  if (!db) return unconfiguredResult();

  const tieUuid = await resolveCupTieUuid(db, input.tieId);
  if (!tieUuid) {
    return { ok: false, code: "NOT_FOUND", error: "Llave de Copa no encontrada." };
  }

  const updatePayload: Record<string, unknown> = {};
  const { patch } = input;

  if ("playerAId" in patch) {
    if (patch.playerAId) {
      const uuid = await resolvePlayerUuid(db, patch.playerAId);
      if (!uuid) {
        return { ok: false, code: "NOT_FOUND", error: "Jugador A no encontrado." };
      }
      updatePayload.player_a_id = uuid;
    } else {
      updatePayload.player_a_id = null;
    }
  }

  if ("playerBId" in patch) {
    if (patch.playerBId) {
      const uuid = await resolvePlayerUuid(db, patch.playerBId);
      if (!uuid) {
        return { ok: false, code: "NOT_FOUND", error: "Jugador B no encontrado." };
      }
      updatePayload.player_b_id = uuid;
    } else {
      updatePayload.player_b_id = null;
    }
  }

  if ("winnerPlayerId" in patch) {
    if (patch.winnerPlayerId) {
      const uuid = await resolvePlayerUuid(db, patch.winnerPlayerId);
      if (!uuid) {
        return {
          ok: false,
          code: "NOT_FOUND",
          error: "Jugador ganador no encontrado.",
        };
      }
      updatePayload.winner_player_id = uuid;
    } else {
      updatePayload.winner_player_id = null;
    }
  }

  if ("overrideScoreA" in patch) {
    if (
      patch.overrideScoreA !== null &&
      patch.overrideScoreA !== undefined &&
      !isNonNegativeInt(patch.overrideScoreA)
    ) {
      return { ok: false, code: "VALIDATION", error: "Global Jugador A inválido." };
    }
    updatePayload.override_score_a = patch.overrideScoreA ?? null;
  }

  if ("overrideScoreB" in patch) {
    if (
      patch.overrideScoreB !== null &&
      patch.overrideScoreB !== undefined &&
      !isNonNegativeInt(patch.overrideScoreB)
    ) {
      return { ok: false, code: "VALIDATION", error: "Global Jugador B inválido." };
    }
    updatePayload.override_score_b = patch.overrideScoreB ?? null;
  }

  if ("notes" in patch) {
    updatePayload.notes = patch.notes?.trim() || null;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { ok: true, message: "Sin cambios para guardar." };
  }

  const { error } = await db
    .from("cup_ties")
    .update(updatePayload)
    .eq("id", tieUuid);

  if (error) {
    return dbErrorResult(error, "No se pudo actualizar la llave de Copa");
  }

  return { ok: true, message: "Llave de Copa actualizada." };
}
