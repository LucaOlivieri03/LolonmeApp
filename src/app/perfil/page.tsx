import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  LogOut,
  Shield,
  Star,
  Trophy,
  UserCircle2,
} from "lucide-react";
import { LoginCard } from "@/components/profile/LoginCard";
import { UnlinkedAccountCard } from "@/components/profile/UnlinkedAccountCard";
import type { PlayerRole, TitleType } from "@/lib/types/domain";
import type { ProfileRecentMatchItem } from "@/lib/types/view-models";
import { signOutAction } from "@/server/actions/auth";
import { getAuthenticatedProfileViewModel } from "@/server/queries";
import { formatDateEs } from "@/lib/utils";

const ROLE_LABELS: Record<PlayerRole, string> = {
  admin: "Presidente / Admin",
  authorized: "Jugador Autorizado",
  player: "Jugador Oficial",
  guest: "Invitado (sin sesión)",
};

const TITLE_LABELS: Record<TitleType, string> = {
  league: "Campeón de Liga",
  cup: "Campeón de Copa",
  lolonmebol: "Campeón LOLONMEBOL",
};

function scoreBadgeLabel(m: ProfileRecentMatchItem): string {
  if (m.teamAScore !== null && m.teamBScore !== null) {
    return `${m.teamAScore} – ${m.teamBScore}`;
  }
  if (m.resultOutcome === "draw") return "Empate";
  if (m.resultOutcome === "A") return "Ganó Eq. A";
  if (m.resultOutcome === "B") return "Ganó Eq. B";
  return "—";
}

interface PerfilPageProps {
  searchParams: Promise<{ authError?: string }>;
}

export default async function PerfilPage({ searchParams }: PerfilPageProps) {
  const [vm, params] = await Promise.all([
    getAuthenticatedProfileViewModel(),
    searchParams,
  ]);

  const headerRoleLabel =
    vm.status === "linked"
      ? ROLE_LABELS[vm.player.role]
      : vm.status === "unlinked"
        ? "Cuenta autenticada (sin vincular)"
        : ROLE_LABELS.guest;

  return (
    <div className="space-y-5">
      <header className="pitch-chalk-surface rounded-lg border border-pitch-900 p-4 text-paper sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <UserCircle2 className="mt-0.5 h-8 w-8 shrink-0 text-gold-400" />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                Mi Perfil · Cuenta de Jugador
              </h1>
              <p className="text-xs text-pitch-100">
                Estado de sesión:{" "}
                <strong className="text-gold-400">{headerRoleLabel}</strong>
                {vm.status === "linked"
                  ? ` · Vinculado a ${vm.player.displayName}`
                  : vm.status === "unlinked" && vm.email
                    ? ` · ${vm.email}`
                    : ""}
              </p>
            </div>
          </div>

          {vm.status !== "guest" && (
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/25 bg-pitch-900/70 px-3.5 text-xs font-bold text-pitch-50 transition-colors hover:bg-pitch-950"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión
              </button>
            </form>
          )}
        </div>
      </header>

      {vm.status === "guest" ? (
        <LoginCard
          isAuthConfigured={vm.isAuthConfigured}
          callbackError={params.authError}
        />
      ) : vm.status === "unlinked" ? (
        <UnlinkedAccountCard
          email={vm.email}
          pendingRequest={vm.pendingRequest}
          availablePlayers={vm.availablePlayers}
        />
      ) : (
        <>
          {/* Official Carnet de Jugador LOLONMEBOL */}
          {(() => {
            const dorsalRank =
              vm.annualRow?.position ?? vm.historicalRow?.position ?? null;
            const starsCount = vm.historicalRow?.stars ?? 0;
            const winRateSource =
              vm.annualRow && vm.annualRow.pj > 0
                ? {
                    label: `Efectividad ${vm.activeSeasonName}`,
                    pg: vm.annualRow.pg,
                    pj: vm.annualRow.pj,
                  }
                : vm.historicalRow && vm.historicalRow.pj > 0
                  ? {
                      label: "Efectividad Histórica",
                      pg: vm.historicalRow.pg,
                      pj: vm.historicalRow.pj,
                    }
                  : null;
            const winRatePct = winRateSource
              ? Math.min(
                  100,
                  Math.max(0, (winRateSource.pg / winRateSource.pj) * 100)
                )
              : null;

            return (
              <section className="grid gap-4 md:grid-cols-3">
                <div className="overflow-hidden rounded-lg border border-rule bg-surface md:col-span-2">
                  {/* Crested Carnet Header Bar */}
                  <div className="pitch-chalk-surface border-b-2 border-gold-500 px-4 py-4 text-paper sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-400/50 bg-pitch-950/70 p-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/assets/Logo.svg"
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-display flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                            {dorsalRank !== null && (
                              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-sm bg-gold-500 px-1.5 text-sm font-extrabold text-ink tabular-nums">
                                #{dorsalRank}
                              </span>
                            )}
                            <span className="truncate">
                              {vm.player.displayName}
                            </span>
                          </h2>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {starsCount > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5"
                                aria-label={`${starsCount} ${starsCount === 1 ? "estrella oficial" : "estrellas oficiales"}`}
                              >
                                {Array.from({ length: starsCount }).map(
                                  (_, i) => (
                                    <Star
                                      key={i}
                                      className="h-4 w-4 fill-gold-400 text-gold-400"
                                      aria-hidden="true"
                                    />
                                  )
                                )}
                              </span>
                            )}
                            {vm.player.email && (
                              <span className="truncate text-xs text-pitch-100">
                                {vm.player.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-white/20 bg-pitch-950/60 px-2.5 py-1 text-xs font-bold text-gold-400">
                        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                        {ROLE_LABELS[vm.player.role]}
                      </span>
                    </div>
                  </div>

                  {/* Carnet Body */}
                  <div className="p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md bg-paper p-3.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                          {vm.activeSeasonName}
                        </span>
                        {vm.annualRow ? (
                          <div className="mt-2 flex items-baseline justify-between">
                            <div>
                              <span className="font-display text-3xl font-extrabold text-pitch-800 tabular-nums">
                                #{vm.annualRow.position}
                              </span>
                              <span className="ml-2 text-xs font-semibold text-ink-muted">
                                ({vm.annualRow.pg}G-{vm.annualRow.pe}E-
                                {vm.annualRow.pp}P · {vm.annualRow.pj} PJ)
                              </span>
                            </div>
                            <span className="font-display text-2xl font-extrabold text-leather-700 tabular-nums">
                              {vm.annualRow.points} pts
                            </span>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-ink-muted">
                            Sin partidos computados en la temporada actual.
                          </p>
                        )}
                      </div>

                      <div className="rounded-md bg-paper p-3.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                          Tabla Histórica Acumulada
                        </span>
                        {vm.historicalRow ? (
                          <div className="mt-2 flex items-baseline justify-between">
                            <div>
                              <span className="font-display text-3xl font-extrabold text-ink tabular-nums">
                                #{vm.historicalRow.position}
                              </span>
                              <span className="ml-2 text-xs font-semibold text-ink-muted">
                                ({vm.historicalRow.pj} PJ ·{" "}
                                {vm.historicalRow.mvps} MVPs)
                              </span>
                            </div>
                            <span className="font-display text-2xl font-extrabold text-pitch-800 tabular-nums">
                              {vm.historicalRow.points} pts
                            </span>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-ink-muted">
                            Sin registros históricos.
                          </p>
                        )}
                      </div>
                    </div>

                    {winRateSource && winRatePct !== null && (
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">
                            {winRateSource.label} (PG%)
                          </span>
                          <span className="font-display text-sm font-extrabold text-pitch-800 tabular-nums">
                            {winRatePct.toFixed(0)}%{" "}
                            <span className="font-sans text-xs font-normal text-ink-muted">
                              ({winRateSource.pg}G / {winRateSource.pj} PJ)
                            </span>
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${winRateSource.label} porcentaje de victorias`}
                          aria-valuenow={Math.round(winRatePct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-2.5 w-full overflow-hidden rounded-sm bg-surface-subtle"
                        >
                          <div
                            className="h-full rounded-sm bg-pitch-600 transition-[width] duration-300 motion-reduce:transition-none"
                            style={{ width: `${winRatePct.toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
                      <Link
                        href={`/stats?tab=player&player=${encodeURIComponent(vm.player.id)}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-pitch-800 px-3.5 text-xs font-bold text-white transition-colors hover:bg-pitch-900"
                      >
                        <BarChart3 className="h-4 w-4" />
                        Explorar mis socios, rivales y gráficas en Stats
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      {(vm.player.role === "admin" ||
                        vm.player.role === "authorized") && (
                        <Link
                          href="/admin"
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule bg-paper px-3.5 text-xs font-bold text-ink transition-colors hover:border-pitch-700"
                        >
                          <Shield className="h-4 w-4 text-pitch-700" />
                          Abrir Panel Admin
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Official Titles & Stars */}
                <aside className="rounded-lg border border-rule bg-surface p-4">
                  <h2 className="font-display flex items-center gap-2 border-b border-rule pb-2 text-lg font-bold tracking-wide text-ink">
                    <Trophy className="h-4 w-4 text-gold-600" />
                    Palmarés y Estrellas ({vm.titles.length})
                  </h2>
                  {vm.titles.length === 0 ? (
                    <p className="py-6 text-xs leading-relaxed text-ink-muted">
                      Todavía no registrás títulos oficiales (Liga, Copa o Final
                      LOLONMEBOL) en el palmarés histórico.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-rule text-xs">
                      {vm.titles.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <Star
                              className="h-4 w-4 shrink-0 fill-gold-500 text-gold-600"
                              aria-hidden="true"
                            />
                            <span className="font-bold text-ink">
                              {TITLE_LABELS[t.titleType]}
                            </span>
                          </div>
                          <span className="text-ink-muted">
                            {formatDateEs(t.awardedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              </section>
            );
          })()}

          {/* Recent Matches Played */}
          <section className="rounded-lg border border-rule bg-surface p-4">
            <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
              <h2 className="font-display text-lg font-bold tracking-wide text-ink">
                Mis Últimos Partidos ({vm.recentMatches.length})
              </h2>
              <Link
                href={`/partidos?season=all&player=${encodeURIComponent(vm.player.id)}`}
                className="inline-flex min-h-10 items-center text-xs font-bold text-pitch-800 hover:underline"
              >
                Ver historial completo
              </Link>
            </div>

            {vm.recentMatches.length === 0 ? (
              <p className="py-4 text-sm text-ink-muted">
                No hay partidos registrados para este jugador.
              </p>
            ) : (
              <ul className="divide-y divide-rule text-sm">
                {vm.recentMatches.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <span className="font-bold text-ink">
                        {m.matchNumber !== null
                          ? `Fecha #${m.matchNumber}`
                          : m.notes || "Fecha Especial"}
                      </span>{" "}
                      <span className="text-xs text-ink-muted">
                        · {formatDateEs(m.matchDate)} · Equipo {m.team}
                      </span>
                      {m.isMvp && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-leather-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                          <Award className="h-3 w-3" />
                          MVP
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {(m.goals > 0 || m.assists > 0) && (
                        <span className="font-semibold text-ink">
                          {m.goals}G / {m.assists}A
                        </span>
                      )}
                      {m.adminRating !== null && (
                        <span className="font-display rounded-sm border border-pitch-200 bg-pitch-50 px-1.5 py-0.5 text-sm font-bold text-pitch-800">
                          {m.adminRating.toFixed(1)}
                        </span>
                      )}
                      <span className="font-display rounded bg-pitch-800 px-2.5 py-1 text-sm font-extrabold text-white">
                        {scoreBadgeLabel(m)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
