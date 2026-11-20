"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, Pin } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { computeStandings, resolveDefaultSeasonId } from "@/lib/engine";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { CupBracketView } from "@/components/tournament/CupBracketView";
import { cn, formatDateEs } from "@/lib/utils";

type HomeTab = "annual" | "historical" | "cup";

export default function HomePage() {
  const { dataset } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(() =>
    resolveDefaultSeasonId(dataset.seasons)
  );
  const [activeTab, setActiveTab] = useState<HomeTab>("annual");

  const resolvedSeasonId = resolveDefaultSeasonId(
    sortedSeasons,
    selectedSeasonId
  );
  const activeSeason =
    sortedSeasons.find((s) => s.id === resolvedSeasonId) ?? sortedSeasons[0];

  const annualStandings = useMemo(
    () =>
      computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
        seasonId: activeSeason?.id,
      }),
    [dataset, activeSeason]
  );

  const historicalStandings = useMemo(
    () =>
      computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
      }),
    [dataset]
  );

  const activeCupEdition = dataset.cupEditions.find(
    (e) => e.seasonId === activeSeason?.id
  );
  const activeCupTies = dataset.cupTies.filter(
    (t) => t.cupEditionId === activeCupEdition?.id
  );

  const seasonMatchesCount = dataset.matches.filter(
    (m) => m.seasonId === activeSeason?.id
  ).length;

  const sortedAnnouncements = useMemo(
    () =>
      [...dataset.announcements].sort(
        (a, b) => Number(b.isPinned) - Number(a.isPinned)
      ),
    [dataset.announcements]
  );

  const latestEvent = dataset.calendarEvents[0];
  const leader = annualStandings.rows[0];

  return (
    <div className="space-y-6">
      {/* Compact Federation Pitch-Line Matchday Strip */}
      <section className="pitch-chalk-surface overflow-hidden rounded-lg border border-pitch-900 text-paper">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
              {activeSeason?.name ?? "Temporada"} · LOLONMEBOL
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pitch-100">
              <span>
                Líder:{" "}
                <strong className="font-bold text-gold-400">
                  {leader?.displayName ?? "—"}
                </strong>{" "}
                <span className="font-display text-base font-bold text-white">
                  ({leader?.points ?? 0} pts)
                </span>
              </span>
              <span className="hidden text-pitch-200/70 sm:inline" aria-hidden="true">
                ·
              </span>
              <span>
                <strong className="font-display text-base font-bold text-white">
                  {seasonMatchesCount}
                </strong>{" "}
                fechas ·{" "}
                <strong className="font-display text-base font-bold text-white">
                  {annualStandings.rows.length}
                </strong>{" "}
                jugadores
              </span>
            </div>
          </div>

          {latestEvent && (
            <Link
              href="/calendario"
              className="group flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-md border border-white/20 bg-pitch-900/55 px-3.5 py-2 text-left transition-colors hover:border-gold-400/60 hover:bg-pitch-900/80 sm:max-w-xs"
            >
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gold-400">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {formatDateEs(latestEvent.eventDate)}
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-white">
                  {latestEvent.title}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-pitch-200 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-400" />
            </Link>
          )}
        </div>
      </section>

      {/* Primary Competition Surface — Above the Fold */}
      <section className="space-y-3" aria-label="Competencias del torneo">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
          <div
            role="tablist"
            aria-label="Vista de competencia"
            className="inline-flex rounded-md border border-rule bg-surface p-0.5"
          >
            {(
              [
                { id: "annual", label: "Tabla Anual" },
                { id: "historical", label: "Histórica" },
                { id: "cup", label: "Copa" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "min-h-10 rounded-sm px-3.5 text-sm font-semibold transition-colors",
                  activeTab === id
                    ? "bg-pitch-800 text-white"
                    : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab !== "historical" && (
            <div className="flex items-center gap-1.5" role="group" aria-label="Temporada">
              {sortedSeasons.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSeasonId(s.id)}
                  className={cn(
                    "font-display min-h-10 rounded-md border px-3.5 text-base font-bold tracking-wide transition-colors",
                    activeSeason?.id === s.id
                      ? "border-leather-600 bg-leather-600 text-white"
                      : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
                  )}
                >
                  {s.year}
                </button>
              ))}
            </div>
          )}
        </div>

        <div role="tabpanel">
          {activeTab === "annual" && (
            <StandingsTable result={annualStandings} mode="annual" />
          )}
          {activeTab === "historical" && (
            <StandingsTable result={historicalStandings} mode="historical" />
          )}
          {activeTab === "cup" && (
            <CupBracketView
              ties={activeCupTies}
              players={dataset.players}
              matches={dataset.matches}
              editionName={activeCupEdition?.name ?? `Copa ${activeSeason?.year ?? ""}`}
            />
          )}
        </div>
      </section>

      {/* Announcements Ledger & Quick Navigation */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-rule bg-surface md:col-span-2">
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
              <Megaphone className="h-4 w-4 text-pitch-700" />
              Tablero de Anuncios
            </h2>
            <span className="text-xs font-medium text-ink-muted">
              {sortedAnnouncements.length} aviso
              {sortedAnnouncements.length === 1 ? "" : "s"}
            </span>
          </div>

          {sortedAnnouncements.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted">
              No hay comunicados oficiales publicados por el momento.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {sortedAnnouncements.slice(0, 4).map((ann) => (
                <li
                  key={ann.id}
                  className={cn(
                    "px-4 py-3",
                    ann.isPinned && "bg-gold-50/70"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    {ann.isPinned && (
                      <Pin className="h-3.5 w-3.5 shrink-0 text-leather-600" />
                    )}
                    <span>{ann.title}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {ann.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="flex flex-col justify-between rounded-lg border border-rule bg-surface p-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-wide text-ink">
              Accesos de Fecha
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Consultá el historial partido a partido, la química entre compañeros y la agenda de la temporada.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/partidos"
              className="flex min-h-11 items-center justify-between rounded-md border border-rule bg-paper px-3.5 text-sm font-semibold text-ink transition-colors hover:border-pitch-700 hover:bg-pitch-50"
            >
              <span>Historial de Partidos</span>
              <ArrowRight className="h-4 w-4 text-pitch-700" />
            </Link>
            <Link
              href="/stats"
              className="flex min-h-11 items-center justify-between rounded-md border border-rule bg-paper px-3.5 text-sm font-semibold text-ink transition-colors hover:border-leather-600 hover:bg-leather-50"
            >
              <span>Lab Grupal y Química</span>
              <ArrowRight className="h-4 w-4 text-leather-600" />
            </Link>
            <Link
              href="/calendario"
              className="flex min-h-11 items-center justify-between rounded-md border border-rule bg-paper px-3.5 text-sm font-semibold text-ink transition-colors hover:border-navy-700 hover:bg-navy-50"
            >
              <span>Calendario Oficial</span>
              <ArrowRight className="h-4 w-4 text-navy-700" />
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
