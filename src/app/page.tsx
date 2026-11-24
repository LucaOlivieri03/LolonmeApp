import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, Pin } from "lucide-react";
import { HomeCompetitionTabs } from "@/components/tournament/HomeCompetitionTabs";
import { cn, formatDateEs } from "@/lib/utils";
import { getHomeViewModel } from "@/server/queries";

interface HomePageProps {
  searchParams: Promise<{ season?: string }>;
}

function parseSeasonYearParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : undefined;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const seasonYear = parseSeasonYearParam(params.season);
  const viewModel = await getHomeViewModel(seasonYear);

  const {
    seasons,
    activeSeason,
    annualStandings,
    historicalStandings,
    cupEditionName,
    cupTies,
    seasonMatchesCount,
    announcements,
    latestEvent,
  } = viewModel;

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
              <span
                className="hidden text-pitch-200/70 sm:inline"
                aria-hidden="true"
              >
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

      {/* Announcements Ledger (Tactical Chalkboard) & Quick Navigation — Above Standings */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="tactical-chalkboard overflow-hidden rounded-lg border-2 border-neutral-800 text-paper md:col-span-2">
          <div className="flex items-center justify-between border-b border-dashed border-white/20 bg-black/35 px-4 py-3">
            <h2 className="font-display flex items-center gap-2 text-lg font-extrabold tracking-wider text-white uppercase">
              <Megaphone className="h-4 w-4 text-gold-400" />
              Tablero de Anuncios · Pizarrón de Tiza
            </h2>
            <span className="rounded-sm border border-dashed border-white/30 bg-white/10 px-2 py-0.5 text-xs font-bold text-gold-400">
              {announcements.length} aviso
              {announcements.length === 1 ? "" : "s"}
            </span>
          </div>

          {announcements.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-300">
              No hay comunicados oficiales escritos en el pizarrón por el momento.
            </p>
          ) : (
            <ul className="space-y-2.5 p-3.5">
              {announcements.slice(0, 4).map((ann) => (
                <li
                  key={ann.id}
                  className={cn(
                    "tactical-chalk-card rounded-md px-3.5 py-2.5 transition-colors",
                    ann.isPinned && "border-gold-400/65 bg-white/[0.07]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-white">
                      {ann.isPinned && (
                        <Pin className="h-3.5 w-3.5 shrink-0 text-gold-400" />
                      )}
                      <span>{ann.title}</span>
                    </div>
                    {ann.isPinned && (
                      <span className="font-display rounded-sm border border-dashed border-gold-400/50 bg-gold-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gold-400 uppercase">
                        Fijado
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-200">
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

      {/* Primary Competition Surface (Thin Client Island with Pre-Computed Rows) */}
      <HomeCompetitionTabs
        seasons={seasons}
        activeSeasonId={activeSeason?.id ?? null}
        annualStandings={annualStandings}
        historicalStandings={historicalStandings}
        cupEditionName={cupEditionName}
        cupTies={cupTies}
      />
    </div>
  );
}
