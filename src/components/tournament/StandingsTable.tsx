"use client";

import { AlertTriangle, Award, Star } from "lucide-react";
import type { StandingsResult } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface StandingsTableProps {
  result: StandingsResult;
  mode: "annual" | "historical";
}

export function StandingsTable({ result, mode }: StandingsTableProps) {
  return (
    <div className="space-y-3">
      {mode === "annual" && result.needsTitleTiebreaker && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold-500/50 bg-gold-100/70 px-3.5 py-2.5 text-xs text-navy-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
          <div>
            <p className="font-bold">Empate en el 1.° puesto por puntos</p>
            <p className="text-slate-700">
              Según el reglamento, al cierre de temporada corresponde disputar un{" "}
              <strong>Partido Desempate de Liga</strong> entre el 1.° y el 2.° puesto.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-pitch-700/15 bg-white shadow-xs">
        <table className="w-full min-w-[540px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-pitch-700/15 bg-pitch-50/80 text-[11px] font-bold uppercase tracking-wider text-navy-800">
              <th className="w-10 py-2.5 pl-3 pr-1 text-center">#</th>
              <th className="py-2.5 px-2">Jugador</th>
              <th className="py-2.5 px-2 text-center font-black text-pitch-800">Pts</th>
              <th className="py-2.5 px-2 text-center">PJ</th>
              <th className="py-2.5 px-2 text-center">G-E-P</th>
              <th className="py-2.5 px-2 text-center">PG%</th>
              <th className="py-2.5 px-2 text-center">MVPs</th>
              {mode === "annual" && (
                <>
                  <th className="py-2.5 px-2 text-center">G/A</th>
                  <th className="py-2.5 pr-3 pl-2 text-center">Prom</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.rows.map((row) => {
              const isLeader = row.position === 1;
              const isDirectCup = mode === "annual" && row.position <= 7;
              const isPrelimCup =
                mode === "annual" && row.position >= 8 && row.position <= 9;

              return (
                <tr
                  key={row.playerId}
                  className={cn(
                    "transition-colors hover:bg-pitch-50/50",
                    isLeader && "bg-gold-100/35"
                  )}
                >
                  <td
                    className={cn(
                      "py-2.5 pl-3 pr-1 text-center font-bold",
                      isDirectCup && "border-l-4 border-l-pitch-600",
                      isPrelimCup && "border-l-4 border-l-gold-500",
                      !isDirectCup && !isPrelimCup && "border-l-4 border-l-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isLeader
                          ? "bg-gold-500 font-black text-navy-900"
                          : "text-slate-700"
                      )}
                    >
                      {row.position}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-semibold text-navy-900">
                    <div className="flex items-center gap-1.5">
                      <span>{row.displayName}</span>
                      {row.stars > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-gold-600"
                          title={`${row.stars} título${row.stars > 1 ? "s" : ""} oficial${row.stars > 1 ? "es" : ""}`}
                        >
                          {Array.from({ length: row.stars }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-3.5 w-3.5 fill-gold-500 text-gold-600"
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-sm font-black text-pitch-800">
                    {row.points}
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium text-slate-600">
                    {row.pj}
                  </td>
                  <td className="py-2.5 px-2 text-center text-xs text-slate-500">
                    {row.pg}-{row.pe}-{row.pp}
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium text-slate-700">
                    {row.winRate.toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {row.mvps > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-800">
                        <Award className="h-3 w-3 text-gold-600" />
                        {row.mvps}
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  {mode === "annual" && (
                    <>
                      <td className="py-2.5 px-2 text-center text-xs font-semibold text-slate-700">
                        {row.goals}/{row.assists}
                      </td>
                      <td className="py-2.5 pr-3 pl-2 text-center text-xs font-bold text-navy-700">
                        {row.avgRating !== null ? row.avgRating.toFixed(2) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode === "annual" && (
        <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-1.5 rounded-xs bg-pitch-600" />
            Top 7: Clasificación directa a Copa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-1.5 rounded-xs bg-gold-500" />
            Zona de Fase Previa / Liberación de cupos
          </span>
        </div>
      )}
    </div>
  );
}
