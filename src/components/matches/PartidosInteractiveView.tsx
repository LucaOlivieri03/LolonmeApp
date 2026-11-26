"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Hash,
  Pencil,
  Shield,
  SlidersHorizontal,
  Trophy,
  X,
} from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import type { MatchType, Season } from "@/lib/types/domain";
import type {
  MatchLedgerItem,
  MatchPlayerOption,
} from "@/lib/types/view-models";
import { cn, formatDateEs } from "@/lib/utils";
import {
  formatMatchScoreBadge,
  shouldShowGoalsAssists,
} from "@/lib/matches/display";

type TypeFilter = "ALL" | MatchType;

const MATCH_TYPE_META: Record<
  MatchType,
  { label: string; badgeClass: string }
> = {
  league: {
    label: "Liga",
    badgeClass: "border-comp-league/60 bg-comp-league-bg text-comp-league-fg",
  },
  league_tiebreaker: {
    label: "Desempate Liga",
    badgeClass: "border-comp-league bg-comp-league text-white",
  },
  cup: {
    label: "Copa",
    badgeClass: "border-comp-cup/60 bg-comp-cup-bg text-comp-cup-fg",
  },
  lolonmebol: {
    label: "LOLONMEBOL",
    badgeClass:
      "border-comp-lolonmebol/60 bg-comp-lolonmebol-bg text-comp-lolonmebol-fg",
  },
  special_f11: {
    label: "Fecha Especial F11",
    badgeClass: "border-comp-f11/60 bg-comp-f11-bg text-comp-f11-fg",
  },
};

export interface PartidosInteractiveViewProps {
  seasons: Season[];
  selectedSeasonId: string;
  selectedType: TypeFilter;
  dateFilter: string;
  matchNumberQuery: string;
  playerFilterId: string;
  availableMatchNumbers: number[];
  playerOptions: MatchPlayerOption[];
  matches: MatchLedgerItem[];
  isAdmin?: boolean;
}

function scoreLabel(m: MatchLedgerItem): string | null {
  return formatMatchScoreBadge(m);
}

export function PartidosInteractiveView({
  seasons,
  selectedSeasonId,
  selectedType,
  dateFilter,
  matchNumberQuery,
  playerFilterId,
  availableMatchNumbers,
  playerOptions,
  matches,
  isAdmin = false,
}: PartidosInteractiveViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    (dateFilter ? 1 : 0) +
    (matchNumberQuery ? 1 : 0) +
    (playerFilterId && playerFilterId !== "ALL" ? 1 : 0);

  const navigateWithFilters = (next: {
    seasonId?: string;
    type?: TypeFilter;
    date?: string;
    number?: string;
    player?: string;
  }) => {
    const resolvedSeasonId = next.seasonId ?? selectedSeasonId;
    const resolvedType = next.type ?? selectedType;
    const resolvedDate = next.date ?? dateFilter;
    const resolvedNumber = next.number ?? matchNumberQuery;
    const resolvedPlayer = next.player ?? playerFilterId;

    const params = new URLSearchParams();
    if (resolvedSeasonId === "ALL") {
      params.set("season", "all");
    } else {
      const seasonObj = seasons.find((s) => s.id === resolvedSeasonId);
      const defaultSeasonId = seasons[0]?.id;
      if (seasonObj && seasonObj.id !== defaultSeasonId) {
        params.set("season", String(seasonObj.year));
      }
    }

    if (resolvedType !== "ALL") params.set("type", resolvedType);
    if (resolvedDate.trim()) params.set("date", resolvedDate.trim());
    if (resolvedNumber.trim()) params.set("number", resolvedNumber.trim());
    if (resolvedPlayer && resolvedPlayer !== "ALL") {
      params.set("player", resolvedPlayer);
    }

    const qs = params.toString();
    const target = qs ? `/partidos?${qs}` : "/partidos";
    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
            <Trophy className="h-6 w-6 text-pitch-700" />
            Partidos y Fechas especiales
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {matches.length} partido{matches.length === 1 ? "" : "s"} en registro
            oficial
            {isPending ? " · Actualizando..." : ""}
          </p>
        </div>

        <div
          className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
          role="group"
          aria-label="Filtrar por temporada"
        >
          {seasons.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={selectedSeasonId === s.id}
              onClick={() => navigateWithFilters({ seasonId: s.id })}
              className={cn(
                "font-display min-h-10 shrink-0 rounded-md border px-3.5 text-base font-bold tracking-wide transition-colors",
                selectedSeasonId === s.id
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              {s.year}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={selectedSeasonId === "ALL"}
            onClick={() => navigateWithFilters({ seasonId: "ALL" })}
            className={cn(
              "min-h-10 shrink-0 rounded-md border px-3.5 text-sm font-semibold transition-colors",
              selectedSeasonId === "ALL"
                ? "border-leather-600 bg-leather-600 text-white"
                : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
            )}
          >
            Todas
          </button>
        </div>
      </header>

      {/* Competition Type & Date / MatchNumber Filter Bar */}
      <div className="space-y-3 rounded-lg border border-rule bg-surface p-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
            role="group"
            aria-label="Filtrar por competencia"
          >
            {(
              [
                { id: "ALL", label: "Todos" },
                { id: "league", label: "Liga" },
                { id: "league_tiebreaker", label: "Desempate" },
                { id: "cup", label: "Copa" },
                { id: "special_f11", label: "Fechas especiales" },
                { id: "lolonmebol", label: "LOLONMEBOL" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selectedType === item.id}
                onClick={() => navigateWithFilters({ type: item.id })}
                className={cn(
                  "min-h-10 shrink-0 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition-colors",
                  selectedType === item.id
                    ? "border-pitch-800 bg-pitch-800 text-white"
                    : "border-rule bg-paper text-ink-muted hover:border-rule-strong hover:text-ink"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 sm:hidden">
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors",
                activeFilterCount > 0
                  ? "border-pitch-800 bg-pitch-50 text-pitch-800"
                  : "border-rule bg-paper text-ink hover:border-rule-strong"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : "Filtros"}
              {filtersOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  navigateWithFilters({
                    date: "",
                    number: "",
                    player: "ALL",
                  })
                }
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-crimson-600/30 bg-crimson-50 px-3 text-xs font-bold text-crimson-700 hover:bg-crimson-100"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div
          className={cn(
            "gap-3 border-t border-rule pt-3 sm:flex sm:flex-wrap sm:items-end",
            filtersOpen ? "grid grid-cols-1" : "hidden sm:flex"
          )}
        >
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <div>
              <label
                htmlFor="partidos-date-filter"
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-ink-muted"
              >
                <Calendar className="h-3.5 w-3.5 text-pitch-700" />
                Fecha calendario
              </label>
              <input
                id="partidos-date-filter"
                type="date"
                value={dateFilter.length === 10 ? dateFilter : ""}
                onChange={(e) => navigateWithFilters({ date: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-rule bg-paper px-3 text-base leading-normal text-ink sm:w-auto sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="partidos-month-filter"
                className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
              >
                O filtrar por mes
              </label>
              <input
                id="partidos-month-filter"
                type="month"
                value={dateFilter.length === 7 ? dateFilter : ""}
                onChange={(e) => navigateWithFilters({ date: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-rule bg-paper px-3 text-base leading-normal text-ink sm:w-auto sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="partidos-number-select"
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              <Hash className="h-3.5 w-3.5 text-leather-600" />
              Fecha de torneo
            </label>
            <select
              id="partidos-number-select"
              value={matchNumberQuery}
              onChange={(e) => navigateWithFilters({ number: e.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold leading-normal text-ink sm:w-auto sm:text-sm"
            >
              <option value="">Todas las fechas</option>
              {matchNumberQuery &&
                !availableMatchNumbers.includes(Number(matchNumberQuery)) && (
                  <option value={matchNumberQuery}>
                    Fecha #{matchNumberQuery}
                  </option>
                )}
              {availableMatchNumbers.map((num) => (
                <option key={num} value={String(num)}>
                  Fecha #{num}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:min-w-[230px] sm:max-w-xs sm:flex-1">
            <PlayerCombobox
              label="Filtrar por jugador"
              options={playerOptions}
              value={playerFilterId}
              onChange={(id) => navigateWithFilters({ player: id })}
              placeholder="Todos los jugadores..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() =>
                navigateWithFilters({
                  date: "",
                  number: "",
                  player: "ALL",
                })
              }
              className="hidden min-h-10 items-center gap-1 rounded-md border border-crimson-600/30 bg-crimson-50 px-3 text-xs font-bold text-crimson-700 hover:bg-crimson-100 sm:inline-flex"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Matchday Ledger */}
      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">
            No hay partidos para esta combinación de filtros.
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Probá cambiando la temporada o volviendo a ver todas las competencias.
          </p>
          <button
            type="button"
            onClick={() =>
              navigateWithFilters({
                seasonId: "ALL",
                type: "ALL",
                date: "",
                number: "",
                player: "ALL",
              })
            }
            className="mt-4 inline-flex min-h-10 items-center rounded-md border border-pitch-800 bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
          >
            Ver todos los partidos
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule transition-opacity",
            isPending && "opacity-70"
          )}
        >
          {matches.map((m) => {
            const meta = MATCH_TYPE_META[m.matchType];
            const isOpen = expandedId === m.id;

            return (
              <article key={m.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedId(isOpen ? null : m.id)}
                  className="flex min-h-16 w-full items-center justify-between gap-2.5 px-3 py-3 text-left transition-colors hover:bg-surface-subtle/50 sm:gap-3 sm:px-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded-sm border px-2 py-0.5 text-xs font-bold",
                          meta.badgeClass
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="shrink-0 rounded-sm bg-surface-subtle px-1.5 py-0.5 text-xs font-bold text-ink-muted sm:px-2">
                        {m.modality}
                      </span>
                      {m.matchNumber !== null && (
                        <span className="font-display shrink-0 whitespace-nowrap text-base font-bold text-ink">
                          Fecha #{m.matchNumber}
                        </span>
                      )}
                      <span className="whitespace-nowrap text-xs font-medium text-ink-muted">
                        {formatDateEs(m.matchDate)}
                      </span>
                    </div>

                    {m.notes && (
                      <p className="truncate text-sm text-ink-muted">
                        {m.notes}
                      </p>
                    )}

                    {m.mvpNames.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-leather-700">
                        <Award className="h-3.5 w-3.5 shrink-0 text-leather-600" />
                        <span>MVP: {m.mvpNames.join(" & ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                    {(() => {
                      const badge = scoreLabel(m);
                      if (!badge) return null;
                      return (
                        <span className="font-display min-w-[3.75rem] rounded-md bg-pitch-800 px-2.5 py-1.5 text-center text-base font-extrabold tracking-wide text-white tabular-nums sm:min-w-[4.25rem] sm:px-3 sm:text-lg">
                          {badge}
                        </span>
                      );
                    })()}
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-ink-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-ink-muted" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-rule bg-paper px-3 py-3.5 sm:px-4">
                    {isAdmin && (
                      <div className="mb-3 flex items-center justify-end border-b border-rule pb-2.5">
                        <Link
                          href={`/admin?matchId=${encodeURIComponent(m.id)}`}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-pitch-800 bg-surface px-3 text-xs font-bold text-pitch-800 transition-colors hover:bg-pitch-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Gestionar en Admin
                        </Link>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 sm:divide-x sm:divide-rule">
                      {(
                        [
                          {
                            label: "Equipo A",
                            list: m.teamA,
                            accent: "text-pitch-800",
                          },
                          {
                            label: "Equipo B",
                            list: m.teamB,
                            accent: "text-navy-800",
                          },
                        ] as const
                      ).map(({ label, list, accent }, idx) => (
                        <div key={label} className={cn(idx === 1 && "sm:pl-4")}>
                          <h2
                            className={cn(
                              "font-display mb-2 flex items-center gap-1.5 border-b border-rule pb-1.5 text-base font-bold uppercase tracking-wider",
                              accent
                            )}
                          >
                            <Shield className="h-4 w-4" />
                            {label} ({list.length})
                          </h2>
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
                                    {mp.displayName}
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
                                    {shouldShowGoalsAssists({
                                      matchDate: m.matchDate,
                                      matchType: m.matchType,
                                      goals: mp.goals,
                                      assists: mp.assists,
                                    }) && (
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
