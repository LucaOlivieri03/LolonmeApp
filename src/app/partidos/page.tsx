"use client";

import { useMemo, useState } from "react";
import { Award, ChevronDown, ChevronUp, Shield, Trophy } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import type { Match, MatchType } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

type TypeFilter = "ALL" | MatchType;

const MATCH_TYPE_META: Record<
  MatchType,
  { label: string; badgeClass: string }
> = {
  league: {
    label: "Liga",
    badgeClass: "bg-pitch-100 text-pitch-800 border-pitch-700/20",
  },
  league_tiebreaker: {
    label: "Desempate Liga",
    badgeClass: "bg-pitch-700 text-white border-pitch-800",
  },
  cup: {
    label: "Copa",
    badgeClass: "bg-gold-100 text-gold-700 border-gold-500/40",
  },
  lolonmebol: {
    label: "Final LOLONMEBOL",
    badgeClass: "bg-navy-800 text-gold-400 border-navy-900",
  },
  special_f11: {
    label: "Fecha Especial F11",
    badgeClass: "bg-sky-400/20 text-navy-800 border-sky-400/40",
  },
};

export default function PartidosPage() {
  const { dataset } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [seasonFilter, setSeasonFilter] = useState<string>(
    sortedSeasons[0]?.id ?? "ALL"
  );
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
      return `${m.teamAScore} - ${m.teamBScore}`;
    }
    if (m.resultOutcome === "draw") return "Empate";
    if (m.resultOutcome === "A") return "Ganó Eq. A";
    if (m.resultOutcome === "B") return "Ganó Eq. B";
    return "Sin marcador";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-navy-900">
            <Trophy className="h-5 w-5 text-pitch-700" />
            Partidos y Fechas Especiales
          </h1>
          <p className="text-xs text-slate-500">
            {filteredMatches.length} partido{filteredMatches.length === 1 ? "" : "s"} encontrados
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {sortedSeasons.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeasonFilter(s.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-bold",
                seasonFilter === s.id
                  ? "border-navy-800 bg-navy-800 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              {s.year}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeasonFilter("ALL")}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs font-bold",
              seasonFilter === "ALL"
                ? "border-navy-800 bg-navy-800 text-white"
                : "border-slate-200 bg-white text-slate-600"
            )}
          >
            Todas
          </button>
        </div>
      </div>

      {/* Competition Type Filter Pills */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: "ALL", label: "Todos" },
            { id: "league", label: "Liga" },
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
              "rounded-full px-3 py-1 text-xs font-bold transition-colors",
              typeFilter === item.id
                ? "bg-pitch-700 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-pitch-50"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Match Cards */}
      <div className="space-y-2.5">
        {filteredMatches.map((m) => {
          const meta = MATCH_TYPE_META[m.matchType];
          const isOpen = expandedId === m.id;
          const teamA = m.players.filter((p) => p.team === "A");
          const teamB = m.players.filter((p) => p.team === "B");
          const mvps = m.players.filter((p) => p.isMvp);

          return (
            <article
              key={m.id}
              className="overflow-hidden rounded-2xl border border-pitch-700/15 bg-white shadow-xs"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : m.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-pitch-50/40"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase",
                        meta.badgeClass
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {m.modality}
                    </span>
                    {m.matchNumber !== null && (
                      <span className="text-xs font-black text-navy-900">
                        Fecha #{m.matchNumber}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">
                      {m.matchDate}
                    </span>
                  </div>

                  {m.notes && (
                    <p className="truncate text-xs font-medium text-slate-600">
                      {m.notes}
                    </p>
                  )}

                  {mvps.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-gold-700">
                      <Award className="h-3.5 w-3.5 text-gold-600" />
                      <span>
                        MVP: {mvps.map((x) => nameOf(x.playerId)).join(" & ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="rounded-xl bg-navy-900 px-3 py-1.5 font-mono text-xs font-black text-white sm:text-sm">
                    {scoreLabel(m)}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { label: "Equipo A", list: teamA, accent: "text-pitch-800" },
                        { label: "Equipo B", list: teamB, accent: "text-navy-800" },
                      ] as const
                    ).map(({ label, list, accent }) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <h3
                          className={cn(
                            "mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider",
                            accent
                          )}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          {label} ({list.length})
                        </h3>
                        <ul className="divide-y divide-slate-100 text-xs">
                          {list.map((mp) => (
                            <li
                              key={mp.id}
                              className="flex items-center justify-between py-1.5"
                            >
                              <span className="font-semibold text-navy-900">
                                {nameOf(mp.playerId)}
                                {mp.isCupCaptain && (
                                  <span className="ml-1 rounded-sm bg-gold-400 px-1 py-0.5 text-[9px] font-black text-navy-900">
                                    CAP
                                  </span>
                                )}
                                {mp.isMvp && (
                                  <span className="ml-1 rounded-sm bg-navy-800 px-1 py-0.5 text-[9px] font-black text-gold-400">
                                    MVP
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
                                {(mp.goals > 0 || mp.assists > 0) && (
                                  <span>
                                    {mp.goals}G / {mp.assists}A
                                  </span>
                                )}
                                {mp.adminRating !== null && (
                                  <span className="rounded-md bg-pitch-50 px-1.5 py-0.5 font-bold text-pitch-800">
                                    {mp.adminRating.toFixed(1)}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
