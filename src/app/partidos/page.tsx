"use client";

import { useMemo, useState } from "react";
import { Award, ChevronDown, ChevronUp, Shield, Trophy } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import type { Match, MatchType } from "@/lib/types/domain";
import { cn, formatDateEs } from "@/lib/utils";

type TypeFilter = "ALL" | MatchType;

const MATCH_TYPE_META: Record<
  MatchType,
  { label: string; badgeClass: string }
> = {
  league: {
    label: "Liga",
    badgeClass: "border-pitch-200 bg-pitch-50 text-pitch-800",
  },
  league_tiebreaker: {
    label: "Desempate Liga",
    badgeClass: "border-crimson-600/30 bg-crimson-50 text-crimson-700",
  },
  cup: {
    label: "Copa",
    badgeClass: "border-gold-500/40 bg-gold-50 text-gold-700",
  },
  lolonmebol: {
    label: "Final LOLONMEBOL",
    badgeClass: "border-pitch-900 bg-pitch-800 text-gold-400",
  },
  special_f11: {
    label: "Fecha Especial F11",
    badgeClass: "border-navy-100 bg-navy-50 text-navy-800",
  },
};

export default function PartidosPage() {
  const { dataset } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [rawSeasonFilter, setSeasonFilter] = useState<string>(
    () => sortedSeasons[0]?.id ?? "ALL"
  );
  const seasonFilter =
    rawSeasonFilter === "ALL" || sortedSeasons.some((s) => s.id === rawSeasonFilter)
      ? rawSeasonFilter
      : (sortedSeasons[0]?.id ?? "ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const playerMap = useMemo(
    () => new Map(dataset.players.map((p) => [p.id, p])),
    [dataset.players]
  );

  const filteredMatches = useMemo(() => {
    return dataset.matches.filter((m) => {
      if (seasonFilter !== "ALL" && m.seasonId !== seasonFilter) return false;
      if (typeFilter !== "ALL" && m.matchType !== typeFilter) return false;
      return true;
    });
  }, [dataset.matches, seasonFilter, typeFilter]);

  const nameOf = (id: string) => playerMap.get(id)?.displayName ?? id;

  const scoreLabel = (m: Match) => {
    if (m.teamAScore !== null && m.teamBScore !== null) {
      return `${m.teamAScore} – ${m.teamBScore}`;
    }
    if (m.resultOutcome === "draw") return "Empate";
    if (m.resultOutcome === "A") return "Ganó Eq. A";
    if (m.resultOutcome === "B") return "Ganó Eq. B";
    return "Sin marcador";
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
            <Trophy className="h-6 w-6 text-pitch-700" />
            Partidos y Fechas Especiales
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {filteredMatches.length} partido{filteredMatches.length === 1 ? "" : "s"} en registro oficial
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por temporada">
          {sortedSeasons.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeasonFilter(s.id)}
              className={cn(
                "font-display min-h-10 rounded-md border px-3.5 text-base font-bold tracking-wide transition-colors",
                seasonFilter === s.id
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              {s.year}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeasonFilter("ALL")}
            className={cn(
              "min-h-10 rounded-md border px-3.5 text-sm font-semibold transition-colors",
              seasonFilter === "ALL"
                ? "border-leather-600 bg-leather-600 text-white"
                : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
            )}
          >
            Todas
          </button>
        </div>
      </header>

      {/* Competition Type Filter Bar */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por competencia">
        {(
          [
            { id: "ALL", label: "Todos" },
            { id: "league", label: "Liga" },
            { id: "league_tiebreaker", label: "Desempate" },
            { id: "cup", label: "Copa" },
            { id: "special_f11", label: "Fechas Especiales" },
            { id: "lolonmebol", label: "Final LOLONMEBOL" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTypeFilter(item.id)}
            className={cn(
              "min-h-10 rounded-md border px-3 text-sm font-semibold transition-colors",
              typeFilter === item.id
                ? "border-pitch-800 bg-pitch-800 text-white"
                : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Matchday Ledger */}
      {filteredMatches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">
            No hay partidos para esta combinación de filtros.
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Probá cambiando la temporada o volviendo a ver todas las competencias.
          </p>
          <button
            type="button"
            onClick={() => {
              setSeasonFilter("ALL");
              setTypeFilter("ALL");
            }}
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-pitch-800 bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
          >
            Ver todos los partidos
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
          {filteredMatches.map((m) => {
            const meta = MATCH_TYPE_META[m.matchType];
            const isOpen = expandedId === m.id;
            const teamA = m.players.filter((p) => p.team === "A");
            const teamB = m.players.filter((p) => p.team === "B");
            const mvps = m.players.filter((p) => p.isMvp);

            return (
              <article key={m.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedId(isOpen ? null : m.id)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle/50"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-sm border px-2 py-0.5 text-xs font-bold",
                          meta.badgeClass
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="rounded-sm bg-surface-subtle px-2 py-0.5 text-xs font-bold text-ink-muted">
                        {m.modality}
                      </span>
                      {m.matchNumber !== null && (
                        <span className="font-display text-base font-bold text-ink">
                          Fecha #{m.matchNumber}
                        </span>
                      )}
                      <span className="text-xs font-medium text-ink-muted">
                        {formatDateEs(m.matchDate)}
                      </span>
                    </div>

                    {m.notes && (
                      <p className="truncate text-sm text-ink-muted">{m.notes}</p>
                    )}

                    {mvps.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-leather-700">
                        <Award className="h-3.5 w-3.5 shrink-0 text-leather-600" />
                        <span>
                          MVP: {mvps.map((x) => nameOf(x.playerId)).join(" & ")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="font-display min-w-[4.25rem] rounded-md bg-pitch-800 px-3 py-1.5 text-center text-lg font-extrabold tracking-wide text-white">
                      {scoreLabel(m)}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-ink-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-ink-muted" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-rule bg-paper px-4 py-3.5">
                    <div className="grid gap-4 sm:grid-cols-2 sm:divide-x sm:divide-rule">
                      {(
                        [
                          { label: "Equipo A", list: teamA, accent: "text-pitch-800" },
                          { label: "Equipo B", list: teamB, accent: "text-navy-800" },
                        ] as const
                      ).map(({ label, list, accent }, idx) => (
                        <div key={label} className={cn(idx === 1 && "sm:pl-4")}>
                          <h3
                            className={cn(
                              "font-display mb-2 flex items-center gap-1.5 border-b border-rule pb-1.5 text-base font-bold uppercase tracking-wider",
                              accent
                            )}
                          >
                            <Shield className="h-4 w-4" />
                            {label} ({list.length})
                          </h3>
                          {list.length === 0 ? (
                            <p className="py-2 text-xs text-ink-muted">
                              Sin jugadores asignados.
                            </p>
                          ) : (
                            <ul className="divide-y divide-rule/70 text-sm">
                              {list.map((mp) => (
                                <li
                                  key={mp.id}
                                  className="flex items-center justify-between gap-2 py-2"
                                >
                                  <span className="font-medium text-ink">
                                    {nameOf(mp.playerId)}
                                    {mp.isCupCaptain && (
                                      <span className="ml-1.5 rounded-sm bg-gold-400 px-1.5 py-0.5 text-[10px] font-extrabold text-ink">
                                        CAP
                                      </span>
                                    )}
                                    {mp.isMvp && (
                                      <span className="ml-1.5 rounded-sm bg-leather-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                                        MVP
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                                    {(mp.goals > 0 || mp.assists > 0) && (
                                      <span className="font-semibold text-ink">
                                        {mp.goals}G / {mp.assists}A
                                      </span>
                                    )}
                                    {mp.adminRating !== null && (
                                      <span className="font-display rounded-sm border border-pitch-200 bg-pitch-50 px-1.5 py-0.5 text-sm font-bold text-pitch-800">
                                        {mp.adminRating.toFixed(1)}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
