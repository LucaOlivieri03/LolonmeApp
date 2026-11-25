"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";
import { MatchEditModal } from "@/components/tournament/MatchEditModal";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { filterMatches, resolveDefaultSeasonId } from "@/lib/engine";
import type {
  Match,
  MatchModality,
  MatchType,
  Player,
  Season,
} from "@/lib/types/domain";
import { cn, formatDateEs } from "@/lib/utils";
import {
  createMatchAction,
  deleteMatchAction,
  updateMatchAction,
} from "@/server/actions/matches";

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  league: "Liga",
  league_tiebreaker: "Desempate Liga",
  cup: "Copa",
  lolonmebol: "Final LOLONMEBOL",
  special_f11: "Fecha Especial F11",
};

interface AdminMatchesTabProps {
  seasons: Season[];
  players: Player[];
  matches: Match[];
  isAdmin: boolean;
  defaultSeasonId: string;
}

export function AdminMatchesTab({
  seasons,
  players,
  matches,
  isAdmin,
  defaultSeasonId,
}: AdminMatchesTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rawSeasonId, setRawSeasonId] = useState(defaultSeasonId);
  const seasonId = resolveDefaultSeasonId(seasons, rawSeasonId);

  const [mType, setMType] = useState<MatchType>("league");
  const [mModality, setMModality] = useState<MatchModality>("F5");
  const [mDate, setMDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mNumber, setMNumber] = useState("");
  const [mScoreA, setMScoreA] = useState("8");
  const [mScoreB, setMScoreB] = useState("6");
  const [mCountsLeague, setMCountsLeague] = useState(true);
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [mvpId, setMvpId] = useState<string>("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string>("ALL");
  const [numberQuery, setNumberQuery] = useState("");
  const [playerFilter, setPlayerFilter] = useState("ALL");
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  const filteredMatches = useMemo(
    () =>
      filterMatches(matches, {
        seasonId: seasonFilter,
        matchType: "ALL",
        matchNumberQuery: numberQuery,
        playerId: playerFilter,
      }),
    [matches, seasonFilter, numberQuery, playerFilter]
  );

  const playerFilterOptions = useMemo(
    () => [
      {
        id: "ALL",
        displayName: `Todos los jugadores (${players.length})`,
      },
      ...players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      })),
    ],
    [players]
  );

  const toggleTeamPlayer = (playerId: string, team: "A" | "B") => {
    if (team === "A") {
      setTeamBIds((prev) => prev.filter((id) => id !== playerId));
      setTeamAIds((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    } else {
      setTeamAIds((prev) => prev.filter((id) => id !== playerId));
      setTeamBIds((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    }
  };

  const handleCreateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamAIds.length === 0 || teamBIds.length === 0) return;

    const sA = mScoreA.trim() === "" ? null : Number(mScoreA);
    const sB = mScoreB.trim() === "" ? null : Number(mScoreB);
    const num = mNumber.trim() === "" ? null : Number(mNumber);

    setFeedback(null);
    startTransition(async () => {
      const res = await createMatchAction({
        seasonId,
        matchNumber: num !== null && Number.isFinite(num) ? num : null,
        matchDate: mDate,
        matchType: mType,
        modality: mModality,
        teamAScore: sA !== null && Number.isFinite(sA) ? sA : null,
        teamBScore: sB !== null && Number.isFinite(sB) ? sB : null,
        countsForLeague: mType === "lolonmebol" ? false : mCountsLeague,
        countsForStats: mType === "special_f11" ? mCountsLeague : true,
        roster: [
          ...teamAIds.map((pid) => ({
            playerId: pid,
            team: "A" as const,
            isMvp: pid === mvpId,
          })),
          ...teamBIds.map((pid) => ({
            playerId: pid,
            team: "B" as const,
            isMvp: pid === mvpId,
          })),
        ],
      });

      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }

      setTeamAIds([]);
      setTeamBIds([]);
      setMvpId("");
      setMNumber("");
      setFeedback({
        type: "success",
        text:
          res.message ??
          "Partido guardado. Tablas y estadísticas recalculadas automáticamente.",
      });
      router.refresh();
    });
  };

  const handleDeleteMatch = (matchId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteMatchAction({ matchId });
      setPendingDeleteKey(null);
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({ type: "success", text: res.message ?? "Partido eliminado." });
      router.refresh();
    });
  };

  const handleSaveEditedMatch = async (updated: Match) => {
    const res = await updateMatchAction({
      matchId: updated.id,
      seasonId: updated.seasonId,
      matchNumber: updated.matchNumber,
      matchDate: updated.matchDate,
      matchType: updated.matchType,
      modality: updated.modality,
      teamAScore: updated.teamAScore,
      teamBScore: updated.teamBScore,
      resultOutcome: updated.resultOutcome ?? null,
      countsForLeague: updated.countsForLeague,
      countsForStats: updated.countsForStats,
      notes: updated.notes ?? null,
      roster: updated.players.map((p) => ({
        playerId: p.playerId,
        team: p.team,
        isCupCaptain: p.isCupCaptain,
        goals: p.goals,
        assists: p.assists,
        adminRating: p.adminRating,
        isMvp: p.isMvp,
      })),
    });

    if (res.ok) {
      setEditingMatch(null);
      setFeedback({
        type: "success",
        text:
          res.message ??
          "Partido editado. Tablas y estadísticas recalculadas automáticamente.",
      });
      router.refresh();
    }

    return res;
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleCreateMatch}
        className="space-y-4 rounded-lg border border-rule bg-surface p-4"
      >
        <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
          <PlusCircle className="h-5 w-5 text-pitch-700" />
          Cargar Nuevo Partido
        </h2>

        <div className="grid gap-2.5 sm:grid-cols-5">
          <select
            aria-label="Temporada"
            value={seasonId}
            onChange={(e) => setRawSeasonId(e.target.value)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Tipo de partido"
            value={mType}
            onChange={(e) => setMType(e.target.value as MatchType)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
          >
            <option value="league">Liga</option>
            <option value="cup">Copa</option>
            <option value="special_f11">Fecha Especial F11</option>
            <option value="league_tiebreaker">Desempate Liga</option>
            <option value="lolonmebol">Final LOLONMEBOL</option>
          </select>
          <select
            aria-label="Modalidad"
            value={mModality}
            onChange={(e) => setMModality(e.target.value as MatchModality)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
          >
            <option value="F5">F5</option>
            <option value="F6">F6</option>
            <option value="F7">F7</option>
            <option value="F11">F11</option>
          </select>
          <input
            type="date"
            aria-label="Fecha del partido"
            value={mDate}
            onChange={(e) => setMDate(e.target.value)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
            required
          />
          <input
            type="number"
            aria-label="Número de fecha"
            placeholder="N° Fecha"
            value={mNumber}
            onChange={(e) => setMNumber(e.target.value)}
            className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold text-pitch-800">
            Goles Eq. A
            <input
              type="number"
              min={0}
              value={mScoreA}
              onChange={(e) => setMScoreA(e.target.value)}
              className="font-display min-h-11 w-16 rounded-md border border-rule bg-paper px-2 text-center text-lg font-bold text-ink"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-navy-800">
            Goles Eq. B
            <input
              type="number"
              min={0}
              value={mScoreB}
              onChange={(e) => setMScoreB(e.target.value)}
              className="font-display min-h-11 w-16 rounded-md border border-rule bg-paper px-2 text-center text-lg font-bold text-ink"
            />
          </label>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={mCountsLeague}
              onChange={(e) => setMCountsLeague(e.target.checked)}
              className="h-4 w-4 accent-pitch-800"
            />
            Suma en Tabla Anual
          </label>
        </div>

        <div className="space-y-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PlayerCombobox
              label="Buscar y sumar/quitar en Equipo A"
              options={players.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                subtitle: teamAIds.includes(p.id)
                  ? "En Equipo A"
                  : teamBIds.includes(p.id)
                    ? "En Equipo B"
                    : undefined,
              }))}
              value={teamSearch}
              onChange={(id) => {
                setTeamSearch(id);
                toggleTeamPlayer(id, "A");
              }}
              placeholder="Buscar jugador para Equipo A..."
              searchPlaceholder="Buscar jugador..."
            />
            <PlayerCombobox
              label="Buscar y sumar/quitar en Equipo B"
              options={players.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                subtitle: teamBIds.includes(p.id)
                  ? "En Equipo B"
                  : teamAIds.includes(p.id)
                    ? "En Equipo A"
                    : undefined,
              }))}
              value={teamSearch}
              onChange={(id) => {
                setTeamSearch(id);
                toggleTeamPlayer(id, "B");
              }}
              placeholder="Buscar jugador para Equipo B..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-pitch-200 bg-pitch-50/40 p-3">
              <p className="font-display mb-2 text-base font-bold text-pitch-800">
                Equipo A ({teamAIds.length})
              </p>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={teamAIds.includes(p.id)}
                    onClick={() => toggleTeamPlayer(p.id, "A")}
                    className={cn(
                      "min-h-9 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                      teamAIds.includes(p.id)
                        ? "border-pitch-800 bg-pitch-800 text-white"
                        : "border-rule bg-surface text-ink hover:border-pitch-700"
                    )}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-navy-100 bg-navy-50/40 p-3">
              <p className="font-display mb-2 text-base font-bold text-navy-800">
                Equipo B ({teamBIds.length})
              </p>
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                {players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={teamBIds.includes(p.id)}
                    onClick={() => toggleTeamPlayer(p.id, "B")}
                    className={cn(
                      "min-h-9 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                      teamBIds.includes(p.id)
                        ? "border-navy-800 bg-navy-800 text-white"
                        : "border-rule bg-surface text-ink hover:border-navy-700"
                    )}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[230px] flex-1 sm:max-w-xs">
            <PlayerCombobox
              label="MVP del partido (opcional)"
              options={[
                { id: "", displayName: "Sin MVP asignado aún" },
                ...[...teamAIds, ...teamBIds].map((id) => ({
                  id,
                  displayName:
                    players.find((p) => p.id === id)?.displayName ?? id,
                })),
              ]}
              value={mvpId}
              onChange={setMvpId}
              placeholder="Sin MVP asignado aún"
              searchPlaceholder="Buscar jugador del partido..."
            />
          </div>

          <button
            type="submit"
            disabled={isPending || teamAIds.length === 0 || teamBIds.length === 0}
            className="min-h-11 rounded-md bg-pitch-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-40"
          >
            {isPending ? "Guardando..." : "Guardar Partido"}
          </button>
        </div>

        {feedback && (
          <p
            className={cn(
              "rounded-md border px-3.5 py-2.5 text-sm font-semibold",
              feedback.type === "success"
                ? "border-pitch-200 bg-pitch-50 text-pitch-800"
                : "border-crimson-600/35 bg-crimson-50 text-crimson-700"
            )}
          >
            {feedback.text}
          </p>
        )}
      </form>

      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold tracking-wide text-ink">
            Todos los Partidos ({filteredMatches.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <PlayerCombobox
                options={playerFilterOptions}
                value={playerFilter}
                onChange={setPlayerFilter}
                placeholder="Filtrar por jugador..."
                searchPlaceholder="Buscar jugador..."
              />
            </div>
            <select
              aria-label="Filtrar temporada en admin"
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="min-h-11 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink"
            >
              <option value="ALL">Todas las temporadas</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="search"
              aria-label="Filtrar por número de fecha en admin"
              placeholder="N° Fecha (ej. 12)"
              value={numberQuery}
              onChange={(e) => setNumberQuery(e.target.value)}
              className="min-h-11 w-36 rounded-md border border-rule bg-paper px-2.5 text-xs text-ink"
            />
          </div>
        </div>
        <ul className="max-h-96 divide-y divide-rule overflow-y-auto text-sm">
          {filteredMatches.map((m) => {
            const delKey = `match:${m.id}`;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 py-2.5"
              >
                <span className="min-w-0">
                  <strong className="text-ink">
                    {MATCH_TYPE_LABELS[m.matchType]}
                    {m.matchNumber !== null ? ` #${m.matchNumber}` : ""}
                  </strong>{" "}
                  <span className="text-ink-muted">
                    · {formatDateEs(m.matchDate)} ·{" "}
                  </span>
                  <span className="font-display text-base font-bold text-pitch-800">
                    {m.teamAScore ?? "—"}–{m.teamBScore ?? "—"}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setEditingMatch(m)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rule bg-paper px-2.5 text-xs font-bold text-pitch-800 transition-colors hover:border-pitch-700 hover:bg-pitch-50 disabled:opacity-50"
                      title="Editar partido completo"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  )}
                  {pendingDeleteKey === delKey ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteMatch(m.id)}
                        className="min-h-9 rounded-md bg-crimson-600 px-2.5 text-xs font-bold text-white hover:bg-crimson-700 disabled:opacity-50"
                      >
                        Borrar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setPendingDeleteKey(null)}
                        className="min-h-9 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink-muted"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPendingDeleteKey(delKey)}
                      className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-crimson-50 hover:text-crimson-600"
                      title="Eliminar partido"
                      aria-label="Eliminar partido"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {editingMatch && isAdmin && (
        <MatchEditModal
          match={editingMatch}
          seasons={seasons}
          players={players}
          onSave={handleSaveEditedMatch}
          onClose={() => setEditingMatch(null)}
        />
      )}
    </div>
  );
}
