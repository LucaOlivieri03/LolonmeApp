"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Minus, Pencil, Plus, Shield, Trash2, X } from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import type {
  Match,
  MatchModality,
  MatchPlayer,
  MatchType,
  Player,
  Season,
} from "@/lib/types/domain";
import type { ActionResult } from "@/lib/types/admin-actions";
import { cn } from "@/lib/utils";

interface MatchEditModalProps {
  match: Match;
  seasons: Season[];
  players: Player[];
  onSave: (updated: Match) => Promise<ActionResult<unknown> | void> | void;
  onClose: () => void;
}

export function MatchEditModal({
  match,
  seasons,
  players,
  onSave,
  onClose,
}: MatchEditModalProps) {
  const idPrefix = useId();
  const dialogRef = useRef<HTMLFormElement>(null);

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError(null);
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

    setIsSaving(true);
    try {
      const res = await onSave(updated);
      if (res && !res.ok) {
        setSaveError(res.error);
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "No se pudieron guardar los cambios."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const teamARoster = roster.filter((p) => p.team === "A");
  const teamBRoster = roster.filter((p) => p.team === "B");

  const stepScore = (
    current: string,
    delta: number,
    setter: (val: string) => void
  ) => {
    const trimmed = current.trim();
    if (trimmed === "") {
      setter(delta > 0 ? "1" : "0");
      return;
    }
    const parsed = Number(trimmed);
    const base = Number.isFinite(parsed) ? parsed : 0;
    setter(String(Math.max(0, base + delta)));
  };

  const liveScoreSummary = useMemo(() => {
    const sA = teamAScore.trim() === "" ? null : Number(teamAScore);
    const sB = teamBScore.trim() === "" ? null : Number(teamBScore);
    const hasBothScores =
      sA !== null && sB !== null && Number.isFinite(sA) && Number.isFinite(sB);

    let verdict = "Sin definir";
    let verdictTone = "text-ink-muted";

    if (hasBothScores) {
      if (sA > sB) {
        verdict = "Ganó Equipo A";
        verdictTone = "text-pitch-800";
      } else if (sB > sA) {
        verdict = "Ganó Equipo B";
        verdictTone = "text-navy-800";
      } else {
        verdict = "Empate";
        verdictTone = "text-leather-700";
      }
    } else if (resultOutcome === "A") {
      verdict = "Ganó Equipo A";
      verdictTone = "text-pitch-800";
    } else if (resultOutcome === "B") {
      verdict = "Ganó Equipo B";
      verdictTone = "text-navy-800";
    } else if (resultOutcome === "draw") {
      verdict = "Empate";
      verdictTone = "text-leather-700";
    }

    return {
      displayA: sA !== null && Number.isFinite(sA) ? String(sA) : "—",
      displayB: sB !== null && Number.isFinite(sB) ? String(sB) : "—",
      verdict,
      verdictTone,
    };
  }, [teamAScore, teamBScore, resultOutcome]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = () => {
      if (!dialogRef.current) return [] as HTMLElement[];
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
    };

    const focusables = getFocusable();
    focusables[0]?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !dialogRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !dialogRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar Partido"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4"
    >
      <form
        ref={dialogRef}
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-rule bg-surface"
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
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-white/20 bg-pitch-900/60 text-white hover:bg-pitch-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Core metadata */}
          <div className="grid gap-2.5 sm:grid-cols-5">
            <div>
              <label
                htmlFor={`${idPrefix}-season`}
                className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
              >
                Temporada
              </label>
              <select
                id={`${idPrefix}-season`}
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-base font-semibold text-ink sm:text-sm"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-type`}
                className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
              >
                Competencia
              </label>
              <select
                id={`${idPrefix}-type`}
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as MatchType)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-base font-semibold text-ink sm:text-sm"
              >
                <option value="league">Liga</option>
                <option value="cup">Copa</option>
                <option value="special_f11">Fecha Especial F11</option>
                <option value="league_tiebreaker">Desempate Liga</option>
                <option value="lolonmebol">LOLONMEBOL</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-modality`}
                className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
              >
                Modalidad
              </label>
              <select
                id={`${idPrefix}-modality`}
                value={modality}
                onChange={(e) => setModality(e.target.value as MatchModality)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-base font-semibold text-ink sm:text-sm"
              >
                <option value="F5">F5</option>
                <option value="F6">F6</option>
                <option value="F7">F7</option>
                <option value="F11">F11</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-date`}
                className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
              >
                Fecha Calendario
              </label>
              <input
                id={`${idPrefix}-date`}
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-base text-ink sm:text-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-number`}
                className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
              >
                N° Fecha Torneo
              </label>
              <input
                id={`${idPrefix}-number`}
                type="number"
                placeholder="Ej. 12"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-base text-ink sm:text-sm"
              />
            </div>
          </div>

          {/* Score, Outcome & Flags */}
          <div className="space-y-3 rounded-md bg-paper p-3">
            {/* Live matchday scoreboard strip */}
            <div
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-surface px-3 py-2"
            >
              <div className="font-display flex items-center gap-2 text-base font-extrabold tracking-wide tabular-nums sm:text-lg">
                <span className="text-pitch-800">Equipo A</span>
                <span className="inline-flex min-w-7 items-center justify-center rounded-sm bg-pitch-800 px-1.5 py-0.5 text-white">
                  {liveScoreSummary.displayA}
                </span>
                <span className="text-ink-muted">–</span>
                <span className="inline-flex min-w-7 items-center justify-center rounded-sm bg-navy-800 px-1.5 py-0.5 text-white">
                  {liveScoreSummary.displayB}
                </span>
                <span className="text-navy-800">Equipo B</span>
              </div>
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  liveScoreSummary.verdictTone
                )}
              >
                {liveScoreSummary.verdict}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor={`${idPrefix}-score-a`}
                  className="block text-[11px] font-bold uppercase tracking-wider text-pitch-800"
                >
                  Goles Eq. A
                </label>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => stepScore(teamAScore, -1, setTeamAScore)}
                    aria-label="Restar gol a Equipo A"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:border-pitch-700 hover:bg-pitch-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    id={`${idPrefix}-score-a`}
                    type="number"
                    min={0}
                    placeholder="—"
                    value={teamAScore}
                    onChange={(e) => setTeamAScore(e.target.value)}
                    className="font-display min-h-10 w-16 rounded-md border border-rule bg-surface px-2 text-center text-base font-bold tabular-nums text-ink sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => stepScore(teamAScore, 1, setTeamAScore)}
                    aria-label="Sumar gol a Equipo A"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:border-pitch-700 hover:bg-pitch-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor={`${idPrefix}-score-b`}
                  className="block text-[11px] font-bold uppercase tracking-wider text-navy-800"
                >
                  Goles Eq. B
                </label>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => stepScore(teamBScore, -1, setTeamBScore)}
                    aria-label="Restar gol a Equipo B"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:border-navy-700 hover:bg-navy-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    id={`${idPrefix}-score-b`}
                    type="number"
                    min={0}
                    placeholder="—"
                    value={teamBScore}
                    onChange={(e) => setTeamBScore(e.target.value)}
                    className="font-display min-h-10 w-16 rounded-md border border-rule bg-surface px-2 text-center text-base font-bold tabular-nums text-ink sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => stepScore(teamBScore, 1, setTeamBScore)}
                    aria-label="Sumar gol a Equipo B"
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:border-navy-700 hover:bg-navy-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label
                  htmlFor={`${idPrefix}-outcome`}
                  className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
                >
                  Resultado (sin goles)
                </label>
                <select
                  id={`${idPrefix}-outcome`}
                  value={resultOutcome}
                  onChange={(e) =>
                    setResultOutcome(e.target.value as "A" | "B" | "draw" | "")
                  }
                  className="mt-1 min-h-10 rounded-md border border-rule bg-surface px-2.5 text-base font-semibold text-ink sm:text-sm"
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
                Suma en Tabla Anual
              </label>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={countsForStats}
                  onChange={(e) => setCountsForStats(e.target.checked)}
                  className="h-4 w-4 accent-pitch-800"
                />
                Suma en Estadísticas
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-notes`}
              className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
            >
              Notas / Descripción del partido
            </label>
            <input
              id={`${idPrefix}-notes`}
              type="text"
              placeholder="Ej. Cuartos de Final - Ida / F11 Aniversario"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
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
                className="rounded-md bg-paper p-3"
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
                <div className="space-y-2">
                  {rows.map((mp) => {
                    const pName =
                      playerMap.get(mp.playerId)?.displayName ?? mp.playerId;
                    return (
                      <div
                        key={mp.playerId}
                        className="space-y-2 rounded-md border border-rule bg-surface p-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                            {pName}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateRosterPlayer(mp.playerId, {
                                  team: mp.team === "A" ? "B" : "A",
                                })
                              }
                              className="inline-flex min-h-10 items-center justify-center rounded-md border border-rule bg-paper px-2.5 text-xs font-bold text-ink-muted hover:text-ink"
                              title="Cambiar de equipo"
                            >
                              Eq.{mp.team}
                            </button>
                            <button
                              type="button"
                              aria-pressed={mp.isCupCaptain}
                              onClick={() =>
                                updateRosterPlayer(mp.playerId, {
                                  isCupCaptain: !mp.isCupCaptain,
                                })
                              }
                              className={cn(
                                "inline-flex min-h-10 items-center justify-center rounded-md px-2.5 text-xs font-extrabold",
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
                              aria-pressed={mp.isMvp}
                              onClick={() =>
                                updateRosterPlayer(mp.playerId, {
                                  isMvp: !mp.isMvp,
                                })
                              }
                              className={cn(
                                "inline-flex min-h-10 items-center justify-center rounded-md px-2.5 text-xs font-extrabold",
                                mp.isMvp
                                  ? "bg-leather-600 text-white"
                                  : "border border-rule bg-paper text-ink-muted"
                              )}
                              title="MVP de la fecha"
                            >
                              MVP
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRosterPlayer(mp.playerId)}
                              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-ink-muted hover:bg-crimson-50 hover:text-crimson-600"
                              aria-label={`Quitar a ${pName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                            <span>Goles</span>
                            <input
                              type="number"
                              min={0}
                              value={mp.goals}
                              onChange={(e) =>
                                updateRosterPlayer(mp.playerId, {
                                  goals: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="min-h-10 w-full rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink sm:text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                            <span>Asist.</span>
                            <input
                              type="number"
                              min={0}
                              value={mp.assists}
                              onChange={(e) =>
                                updateRosterPlayer(mp.playerId, {
                                  assists: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className="min-h-10 w-full rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink sm:text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
                            <span>Calif.</span>
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
                              className="min-h-10 w-full rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink sm:text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Add Player to Roster via PlayerCombobox */}
          <div className="grid gap-3 rounded-md bg-paper p-3 sm:grid-cols-2">
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

        {saveError && (
          <div
            role="alert"
            className="border-t border-crimson-600/35 bg-crimson-50 px-4 py-2.5 text-xs font-semibold text-crimson-700"
          >
            {saveError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-rule bg-surface-subtle px-4 py-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="min-h-10 rounded-md border border-rule bg-surface px-4 text-xs font-bold text-ink-muted hover:text-ink disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-pitch-800 px-4 text-xs font-bold text-white hover:bg-pitch-900 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
