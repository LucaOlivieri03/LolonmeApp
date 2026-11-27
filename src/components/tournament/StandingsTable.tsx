"use client";

import { Fragment, useState } from "react";
import { AlertTriangle, Award, ChevronDown, ChevronUp, Crown, Star } from "lucide-react";
import type { StandingsResult } from "@/lib/engine";
import { cn } from "@/lib/utils";

interface StandingsTableProps {
  result: StandingsResult;
  mode: "annual" | "historical";
  initialLimit?: number;
  hasCupStarted?: boolean;
}

export function StandingsTable({
  result,
  mode,
  initialLimit = mode === "historical" ? 15 : undefined,
  hasCupStarted = false,
}: StandingsTableProps) {
  const [expanded, setExpanded] = useState(false);

  if (result.rows.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface p-6 text-center text-sm text-ink-muted">
        No hay partidos computados para esta tabla todavía.
      </div>
    );
  }

  const hasLimit =
    typeof initialLimit === "number" && result.rows.length > initialLimit;
  const visibleRows =
    hasLimit && !expanded ? result.rows.slice(0, initialLimit) : result.rows;

  return (
    <div className="space-y-2.5">
      {mode === "annual" && result.needsTitleTiebreaker && (
        <div className="flex items-start gap-2.5 rounded-lg border border-crimson-600/40 bg-crimson-50 px-4 py-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-crimson-600" />
          <div>
            <p className="font-bold text-crimson-700">
              Empate en el 1.° puesto por puntos
            </p>
            <p className="mt-0.5 text-ink-muted">
              Según el reglamento oficial, al cierre de temporada corresponde disputar un{" "}
              <strong className="text-ink">Partido Desempate de Liga</strong> entre el 1.° y el 2.° puesto.
            </p>
          </div>
        </div>
      )}

      <p className="flex items-center justify-end text-xs font-medium text-ink-muted sm:hidden">
        Deslizá la tabla para ver G-E-P, PG%{mode === "annual" ? ", G/A y Prom" : " y MVPs"} →
      </p>

      <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full min-w-[540px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-rule bg-surface-subtle text-xs font-bold uppercase tracking-wider text-ink-muted">
              <th
                scope="col"
                className="sticky left-0 z-20 w-12 bg-surface-subtle py-2.5 pl-3 pr-1.5 text-center"
              >
                #
              </th>
              <th
                scope="col"
                className="sticky left-12 z-20 border-r border-rule/80 bg-surface-subtle py-2.5 px-2.5"
              >
                Jugador
              </th>
              <th
                scope="col"
                className="py-2.5 px-2.5 text-center font-extrabold text-pitch-800"
              >
                Pts
              </th>
              <th scope="col" className="py-2.5 px-2 text-center">
                PJ
              </th>
              <th scope="col" className="py-2.5 px-2 text-center">
                G-E-P
              </th>
              <th scope="col" className="py-2.5 px-2 text-center">
                PG%
              </th>
              <th scope="col" className="py-2.5 px-2 text-center">
                MVPs
              </th>
              {mode === "annual" && (
                <>
                  <th scope="col" className="py-2.5 px-2 text-center">
                    G/A
                  </th>
                  <th scope="col" className="py-2.5 pl-2 pr-3 text-center">
                    Prom
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/75">
            {visibleRows.map((row, idx) => {
              const isLeader = row.position === 1;
              const showCupZones = mode === "annual" && !hasCupStarted;
              const isDirectCup = showCupZones && row.position <= 7;
              const isPrelimCup =
                showCupZones && row.position >= 8 && row.position <= 9;
              const rowBg = isLeader ? "bg-gold-50" : "bg-surface";
              const trHover = isLeader
                ? "hover:bg-gold-100"
                : "hover:bg-pitch-50";
              const stickyHover = isLeader
                ? "group-hover:bg-gold-100"
                : "group-hover:bg-pitch-50";
              const hasMoreBelow = idx < visibleRows.length - 1;
              const showTop7Cut =
                showCupZones && row.position === 7 && hasMoreBelow;
              const showPrelimCut =
                showCupZones && row.position === 9 && hasMoreBelow;

              return (
                <Fragment key={row.playerId}>
                  <tr
                    className={cn(
                      "group transition-colors",
                      rowBg,
                      trHover
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 py-2.5 pl-3 pr-1.5 text-center transition-colors",
                        rowBg,
                        stickyHover
                      )}
                    >
                      <span
                        className={cn(
                          "font-display inline-flex h-7 w-7 items-center justify-center rounded-sm text-sm font-extrabold",
                          isLeader
                            ? "bg-gold-500 text-ink"
                            : isDirectCup
                              ? "bg-comp-cup text-white"
                              : isPrelimCup
                                ? "border border-comp-cup/50 bg-comp-cup-bg text-comp-cup-fg"
                                : "bg-surface-subtle text-ink-muted"
                        )}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "sticky left-12 z-10 border-r border-rule/60 py-2.5 px-2.5 font-semibold text-ink transition-colors",
                        rowBg,
                        stickyHover
                      )}
                    >
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isLeader && row.points > 0 && (
                          <Crown
                            className="h-3.5 w-3.5 shrink-0 text-gold-500"
                            aria-hidden="true"
                          />
                        )}
                        <span>{row.displayName}</span>
                        {row.stars > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-gold-700"
                            title={`${row.stars} título${row.stars > 1 ? "s" : ""} oficial${row.stars > 1 ? "es" : ""}`}
                            aria-label={`${row.stars} título${row.stars > 1 ? "s" : ""}`}
                          >
                            {Array.from({ length: row.stars }).map((_, i) => (
                              <Star
                                key={i}
                                className="h-3.5 w-3.5 fill-gold-500 text-gold-700"
                                aria-hidden="true"
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-display py-2.5 px-2.5 text-center text-lg font-extrabold text-pitch-800">
                      {row.points}
                    </td>
                    <td className="py-2.5 px-2 text-center font-medium text-ink-muted">
                      {row.pj}
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs font-medium text-ink-muted">
                      {row.pg}-{row.pe}-{row.pp}
                    </td>
                    <td className="py-2.5 px-2 text-center font-medium text-ink">
                      {row.winRate.toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {row.mvps > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-leather-600/25 bg-leather-50 px-2 py-0.5 text-xs font-bold text-leather-700">
                          <Award className="h-3 w-3 text-leather-600" aria-hidden="true" />
                          {row.mvps}
                        </span>
                      ) : (
                        <span className="text-rule-strong">—</span>
                      )}
                    </td>
                    {mode === "annual" && (
                      <>
                        <td className="py-2.5 px-2 text-center text-xs font-semibold text-ink">
                          {row.goals}/{row.assists}
                        </td>
                        <td className="py-2.5 pl-2 pr-3 text-center text-xs font-bold text-navy-700">
                          {row.avgRating !== null ? row.avgRating.toFixed(2) : "—"}
                        </td>
                      </>
                    )}
                  </tr>

                  {(showTop7Cut || showPrelimCut) && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={9}
                        className={cn(
                          "border-y border-dashed px-3 py-1",
                          showTop7Cut
                            ? "border-pitch-600/45 bg-pitch-50/40"
                            : "border-gold-600/45 bg-gold-50/50"
                        )}
                      >
                        <div className="sticky left-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full",
                              showTop7Cut ? "bg-pitch-700" : "bg-gold-600"
                            )}
                          />
                          <span
                            className={
                              showTop7Cut ? "text-pitch-800" : "text-gold-700"
                            }
                          >
                            {showTop7Cut
                              ? "Corte directo a Copa · Top 7"
                              : "Corte Fase Previa · #8–#9"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasLimit && (
        <div className="flex items-center justify-between rounded-lg border border-rule bg-surface px-4 py-2.5">
          <span className="text-xs font-medium text-ink-muted">
            Mostrando {visibleRows.length} de {result.rows.length} jugadores registrados
          </span>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-pitch-800 bg-pitch-50 px-3 text-xs font-bold text-pitch-800 transition-colors hover:bg-pitch-100"
          >
            {expanded ? (
              <>
                Mostrar top {initialLimit}
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Ver tabla completa ({result.rows.length})
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      )}

      {mode === "annual" && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded-sm bg-gold-500" />
            1.° Puesto: Juega la LOLONMEBOL
          </span>
          {!hasCupStarted && (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-sm bg-comp-cup" />
                Top 7: Clasificación directa a Copa
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-sm border border-comp-cup/50 bg-comp-cup-bg" />
                8.°–9.°: Fase Previa / Liberación de cupos
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
