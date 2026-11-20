"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Megaphone, Pin, Trophy, Users } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { computeStandings } from "@/lib/engine";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { CupBracketView } from "@/components/tournament/CupBracketView";
import { cn } from "@/lib/utils";

type HomeTab = "annual" | "historical" | "cup";

export default function HomePage() {
  const { dataset } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    sortedSeasons[0]?.id ?? "season-2026"
  );
  const [activeTab, setActiveTab] = useState<HomeTab>("annual");

  const activeSeason =
    sortedSeasons.find((s) => s.id === selectedSeasonId) ?? sortedSeasons[0];

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

  return (
    <div className="space-y-5">
      {/* Football Pitch Hero Banner */}
      <section className="pitch-stripes relative overflow-hidden rounded-2xl p-5 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/LogoLOLONMEBOL.svg"
              alt="LOLONMEBOL"
              className="h-14 w-14 shrink-0 rounded-xl bg-white/95 p-1.5 shadow-sm sm:h-16 sm:w-16"
            />
            <div>
              <span className="inline-block rounded-full bg-gold-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-navy-900">
                {activeSeason?.name ?? "Temporada"}
              </span>
              <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                Torneo Oficial LOLONMEBOL
              </h1>
              <p className="text-xs text-white/90 sm:text-sm">
                Líder actual:{" "}
                <strong className="text-gold-400">
                  {annualStandings.rows[0]?.displayName ?? "—"} (
                  {annualStandings.rows[0]?.points ?? 0} pts)
                </strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            <div className="rounded-xl bg-black/20 px-3 py-2 text-center backdrop-blur-xs">
              <span className="block text-lg font-black">{seasonMatchesCount}</span>
              <span className="text-[10px] font-semibold uppercase text-white/80">
                Fechas
              </span>
            </div>
            <div className="rounded-xl bg-black/20 px-3 py-2 text-center backdrop-blur-xs">
              <span className="block text-lg font-black">
                {annualStandings.rows.length}
              </span>
              <span className="text-[10px] font-semibold uppercase text-white/80">
                Jugadores
              </span>
            </div>
            <div className="rounded-xl bg-black/20 px-3 py-2 text-center backdrop-blur-xs">
              <span className="block text-lg font-black">
                {dataset.seasons.length}
              </span>
              <span className="text-[10px] font-semibold uppercase text-white/80">
                Temporadas
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Announcements & Next/Latest Event */}
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs md:col-span-2">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-navy-800">
              <Megaphone className="h-4 w-4 text-pitch-700" />
              Tablero de Anuncios
            </h2>
            <span className="text-[11px] text-slate-400">
              {sortedAnnouncements.length} aviso
              {sortedAnnouncements.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2">
            {sortedAnnouncements.slice(0, 3).map((ann) => (
              <article
                key={ann.id}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-xs",
                  ann.isPinned
                    ? "border-gold-500/40 bg-gold-100/40"
                    : "border-slate-100 bg-slate-50/70"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold text-navy-900">
                  {ann.isPinned && (
                    <Pin className="h-3.5 w-3.5 shrink-0 text-gold-700" />
                  )}
                  <span>{ann.title}</span>
                </div>
                <p className="mt-1 leading-relaxed text-slate-600">{ann.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-navy-800/15 bg-navy-900 p-4 text-white shadow-xs">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-400">
              <Calendar className="h-3.5 w-3.5" />
              Agenda Reciente
            </div>
            {latestEvent ? (
              <div className="mt-2.5">
                <p className="text-base font-black leading-snug">
                  {latestEvent.title}
                </p>
                <p className="mt-1 text-xs text-navy-100">
                  Fecha: {latestEvent.eventDate}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-navy-100">Sin eventos cargados.</p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              href="/calendario"
              className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-white/20"
            >
              Ver Calendario
            </Link>
            <Link
              href="/stats"
              className="flex-1 rounded-xl bg-gold-400 px-3 py-2 text-center text-xs font-black text-navy-900 transition-colors hover:bg-gold-500"
            >
              Lab Grupal
            </Link>
          </div>
        </div>
      </section>

      {/* Main Competition Tabs + Season Switcher */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-pitch-700/15 bg-white p-1 shadow-xs">
            {(
              [
                { id: "annual", label: "Tabla Anual", icon: Trophy },
                { id: "historical", label: "Histórica", icon: Users },
                { id: "cup", label: "Copa", icon: Trophy },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                  activeTab === id
                    ? "bg-pitch-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-pitch-50 hover:text-pitch-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab !== "historical" && (
            <div className="flex items-center gap-1.5">
              {sortedSeasons.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSeasonId(s.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
                    activeSeason?.id === s.id
                      ? "border-navy-800 bg-navy-800 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-navy-600"
                  )}
                >
                  {s.year}
                </button>
              ))}
            </div>
          )}
        </div>

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
      </section>
    </div>
  );
}
