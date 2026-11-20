"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Shield, Trash2, X } from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import type {
  Match,
  MatchModality,
  MatchPlayer,
  MatchType,
  Player,
  Season,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils";

interface MatchEditModalProps {
  match: Match;
  seasons: Season[];
  players: Player[];
  onSave: (updated: Match) => void;
  onClose: () => void;
}

export function MatchEditModal({
  match,
  seasons,
  players,
  onSave,
  onClose,
}: MatchEditModalProps) {
  const [seasonId, setSeasonId] = useState(match.seasonId);
  const [matchDate, setMatchDate] = useState(match.matchDate);
  const [matchNumber, setMatchNumber] = useState(
    match.matchNumber !== null ? String(match.matchNumber) : ""
  );
  const [matchType, setMatchType] = useState<MatchType>(match.matchType);
  const [modality, setModality] = useState<MatchModality>(match.modality);
  const [teamAScore, setTeamAScore] = useState(
    match.teamAScore !== null ? String(match.teamAScore) : ""
  );
  const [teamBScore, setTeamBScore] = useState(
    match.teamBScore !== null ? String(match.teamBScore) : ""
  );
  const [resultOutcome, setResultOutcome] = useState<"A" | "B" | "draw" | "">(
    match.resultOutcome ?? ""
  );
  const [countsForLeague, setCountsForLeague] = useState(match.countsForLeague);
  const [countsForStats, setCountsForStats] = useState(match.countsForStats);
  const [notes, setNotes] = useState(match.notes ?? "");
  const [roster, setRoster] = useState<MatchPlayer[]>(() =>
    match.players.map((p) => ({ ...p }))
  );
  const [addSearch, setAddSearch] = useState("");

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const rosterIds = useMemo(
    () => new Set(roster.map((r) => r.playerId)),
    [roster]
  );

  const availablePlayers = useMemo(() => {
    return players.filter((p) => !rosterIds.has(p.id));
  }, [players, rosterIds]);

  const availableOptions = useMemo(
    () =>
      availablePlayers.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      })),
    [availablePlayers]
  );

  const updateRosterPlayer = (
    playerId: string,
    patch: Partial<MatchPlayer>
  ) => {
    setRoster((prev) =>
      prev.map((mp) => (mp.playerId === playerId ? { ...mp, ...patch } : mp))
    );
  };

  const removeRosterPlayer = (playerId: string) => {
    setRoster((prev) => prev.filter((mp) => mp.playerId !== playerId));
  };

  const addRosterPlayer = (playerId: string, team: "A" | "B") => {
    setRoster((prev) => [
      ...prev,
      {
        id: `${match.id}-${playerId}`,
        matchId: match.id,
        playerId,
        team,
        isCupCaptain: false,
        goals: 0,
        assists: 0,
        adminRating: null,
        isMvp: false,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sA = teamAScore.trim() === "" ? null : Number(teamAScore);
    const sB = teamBScore.trim() === "" ? null : Number(teamBScore);
    const num = matchNumber.trim() === "" ? null : Number(matchNumber);

    const updated: Match = {
      ...match,
      seasonId,
      matchDate,
      matchNumber: num !== null && Number.isFinite(num) ? num : null,
      matchType,
      modality,
      teamAScore: sA !== null && Number.isFinite(sA) ? sA : null,
      teamBScore: sB !== null && Number.isFinite(sB) ? sB : null,
      resultOutcome:
        sA !== null && sB !== null && Number.isFinite(sA) && Number.isFinite(sB)
          ? sA > sB
            ? "A"
            : sB > sA
              ? "B"
              : "draw"
          : resultOutcome || null,
      countsForLeague,
      countsForStats,
      notes: notes.trim() || null,
      players: roster,
    };

    onSave(updated);
  };

  const teamARoster = roster.filter((p) => p.team === "A");
  const teamBRoster = roster.filter((p) => p.team === "B");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar Partido"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 sm:p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-rule bg-surface shadow-xl"
      >
        <div className="pitch-chalk-surface flex items-center justify-between border-b border-pitch-900 px-4 py-3 text-paper">
          <h2 className="font-display flex items-center gap-2 text-xl font-extrabold tracking-wide text-white">
            <Pencil className="h-4 w-4 text-gold-400" />
            Editar Partido Completo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-pitch-900/60 text-white hover:bg-pitch-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Core metadata */}
          <div className="grid gap-2.5 sm:grid-cols-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Temporada
              </label>
              <select
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-sm font-semibold text-ink"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Competencia
              </label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as MatchType)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-sm font-semibold text-ink"
              >
                <option value="league">Liga</option>
                <option value="cup">Copa</option>
                <option value="special_f11">Fecha Especial F11</option>
                <option value="league_tiebreaker">Desempate Liga</option>
                <option value="lolonmebol">Final LOLONMEBOL</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Modalidad
              </label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as MatchModality)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-sm font-semibold text-ink"
              >
                <option value="F5">F5</option>
                <option value="F6">F6</option>
                <option value="F7">F7</option>
                <option value="F11">F11</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Fecha Calendario
              </label>
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-sm text-ink"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                N° Fecha Torneo
              </label>
              <input
                type="number"
                placeholder="Ej. 12"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-sm text-ink"
              />
            </div>
          </div>

          {/* Score, Outcome & Flags */}
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-rule bg-paper p-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-pitch-800">
                Goles Eq. A
              </label>
              <input
                type="number"
                placeholder="—"
                value={teamAScore}
                onChange={(e) => setTeamAScore(e.target.value)}
                className="font-display mt-1 min-h-10 w-20 rounded-md border border-rule bg-surface px-2 text-center text-lg font-bold text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-navy-800">
                Goles Eq. B
              </label>
              <input
                type="number"
                placeholder="—"
                value={teamBScore}
                onChange={(e) => setTeamBScore(e.target.value)}
                className="font-display mt-1 min-h-10 w-20 rounded-md border border-rule bg-surface px-2 text-center text-lg font-bold text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Resultado (sin goles)
              </label>
              <select
                value={resultOutcome}
                onChange={(e) =>
                  setResultOutcome(e.target.value as "A" | "B" | "draw" | "")
                }
                className="mt-1 min-h-10 rounded-md border border-rule bg-surface px-2.5 text-xs font-semibold text-ink"
              >
                <option value="">Automático por goles</option>
                <option value="A">Ganó Equipo A</option>
                <option value="B">Ganó Equipo B</option>
                <option value="draw">Empate</option>
              </select>
            </div>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={countsForLeague}
                onChange={(e) => setCountsForLeague(e.target.checked)}
                className="h-4 w-4 accent-pitch-800"
              />
              Suma Tabla Anual (countsForLeague)
            </label>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={countsForStats}
                onChange={(e) => setCountsForStats(e.target.checked)}
                className="h-4 w-4 accent-pitch-800"
              />
              Suma Estadísticas (countsForStats)
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Notas / Descripción del partido
            </label>
            <input
              type="text"
              placeholder="Ej. Cuartos de Final - Ida / F11 Aniversario"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink"
            />
          </div>

          {/* Roster Table for Team A and Team B */}
          <div className="grid gap-3 lg:grid-cols-2">
            {(
              [
                { team: "A" as const, title: "Planilla Equipo A", rows: teamARoster, accent: "text-pitch-800" },
                { team: "B" as const, title: "Planilla Equipo B", rows: teamBRoster, accent: "text-navy-800" },
              ] as const
            ).map(({ team, title, rows, accent }) => (
              <div
                key={team}
                className="rounded-md border border-rule bg-paper p-3"
              >
                <h3
                  className={cn(
                    "font-display mb-2 flex items-center gap-1.5 text-base font-bold uppercase tracking-wider",
                    accent
                  )}
                >
                  <Shield className="h-4 w-4" />
                  {title} ({rows.length})
                </h3>
                <div className="space-y-1.5">
                  {rows.map((mp) => {
                    const pName =
                      playerMap.get(mp.playerId)?.displayName ?? mp.playerId;
                    return (
                      <div
                        key={mp.playerId}
                        className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-rule bg-surface px-2.5 py-1.5 text-xs"
                      >
                        <span className="min-w-[90px] font-bold text-ink">
                          {pName}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateRosterPlayer(mp.playerId, {
                                team: mp.team === "A" ? "B" : "A",
                              })
                            }
                            className="rounded border border-rule bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink-muted hover:text-ink"
                            title="Cambiar de equipo"
                          >
                            Eq.{mp.team}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateRosterPlayer(mp.playerId, {
                                isCupCaptain: !mp.isCupCaptain,
                              })
                            }
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-extrabold",
                              mp.isCupCaptain
                                ? "bg-gold-400 text-ink"
                                : "border border-rule bg-paper text-ink-muted"
                            )}
                            title="Capitán de Copa (0 pts / 0 PJ en Liga)"
                          >
                            CAP
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateRosterPlayer(mp.playerId, {
                                isMvp: !mp.isMvp,
                              })
                            }
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-extrabold",
                              mp.isMvp
                                ? "bg-leather-600 text-white"
                                : "border border-rule bg-paper text-ink-muted"
                            )}
                            title="MVP de la fecha"
                          >
                            MVP
                          </button>
                          <label className="flex items-center gap-0.5 text-[10px] font-semibold text-ink-muted">
                            G
                            <input
                              type="number"
                              min={0}
                              value={mp.goals}
                              onChange={(e) =>
                                updateRosterPlayer(mp.playerId, {
                                  goals: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="h-7 w-11 rounded border border-rule bg-paper px-1 text-center text-xs font-bold text-ink"
                            />
                          </label>
                          <label className="flex items-center gap-0.5 text-[10px] font-semibold text-ink-muted">
                            A
                            <input
                              type="number"
                              min={0}
                              value={mp.assists}
                              onChange={(e) =>
                                updateRosterPlayer(mp.playerId, {
                                  assists: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="h-7 w-11 rounded border border-rule bg-paper px-1 text-center text-xs font-bold text-ink"
                            />
                          </label>
                          <label className="flex items-center gap-0.5 text-[10px] font-semibold text-ink-muted">
                            Cal
                            <input
                              type="number"
                              step="0.1"
                              min={0}
                              max={10}
                              placeholder="—"
                              value={mp.adminRating ?? ""}
                              onChange={(e) =>
                                updateRosterPlayer(mp.playerId, {
                                  adminRating:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              className="h-7 w-13 rounded border border-rule bg-paper px-1 text-center text-xs font-bold text-ink"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeRosterPlayer(mp.playerId)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-muted hover:bg-crimson-50 hover:text-crimson-600"
                            aria-label={`Quitar a ${pName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add Player to Roster via PlayerCombobox */}
          <div className="grid gap-3 rounded-md border border-rule bg-paper p-3 sm:grid-cols-2">
            <PlayerCombobox
              label="Sumar jugador a Equipo A"
              options={availableOptions}
              value={addSearch}
              onChange={(id) => {
                addRosterPlayer(id, "A");
                setAddSearch("");
              }}
              placeholder="Buscar jugador para Equipo A..."
              searchPlaceholder="Buscar jugador..."
              emptyMessage="Todos los jugadores ya están en la planilla"
            />
            <PlayerCombobox
              label="Sumar jugador a Equipo B"
              options={availableOptions}
              value={addSearch}
              onChange={(id) => {
                addRosterPlayer(id, "B");
                setAddSearch("");
              }}
              placeholder="Buscar jugador para Equipo B..."
              searchPlaceholder="Buscar jugador..."
              emptyMessage="Todos los jugadores ya están en la planilla"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-rule bg-surface-subtle px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-rule bg-surface px-4 text-xs font-bold text-ink-muted hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-pitch-800 px-4 text-xs font-bold text-white hover:bg-pitch-900"
          >
            <Check className="h-4 w-4" />
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
}
