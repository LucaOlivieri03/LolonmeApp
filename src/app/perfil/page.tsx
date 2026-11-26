import Link from "next/link";
import {
  AlertTriangle,
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
  league: "Campeón de Liga Anual",
  cup: "Campeón de Copa LOLONMEBOL",
  lolonmebol: "Campeón Final LOLONMEBOL",
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
        <section className="mx-auto max-w-xl rounded-lg border border-leather-600/40 bg-surface p-6 text-center sm:p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-leather-600" />
          <h2 className="font-display mt-3 text-2xl font-extrabold tracking-wide text-ink">
            Cuenta pendiente de vinculación
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
            Iniciaste sesión correctamente
            {vm.email ? (
              <>
                {" "}
                con <strong className="text-ink">{vm.email}</strong>
              </>
            ) : null}
            , pero ese correo todavía no figura asociado a un jugador activo del
            padrón oficial LOLONMEBOL.
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-ink-muted">
            Pedile a un Administrador del torneo que asocie tu correo a tu ficha
            en el padrón de jugadores para habilitar tus estadísticas personales
            y permisos.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/stats?tab=player"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-pitch-700"
            >
              <BarChart3 className="h-4 w-4 text-pitch-700" />
              Explorar Stats por Jugador
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900"
              >
                <LogOut className="h-4 w-4" />
                Usar otro correo
              </button>
            </form>
          </div>
        </section>
      ) : (
        <>
          {/* Personal Federation Card */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-rule bg-surface p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-3">
                <div>
                  <h2 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
                    {vm.player.displayName}
                    {(vm.historicalRow?.stars ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({
                          length: vm.historicalRow?.stars ?? 0,
                        }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-5 w-5 fill-gold-500 text-gold-600"
                          />
                        ))}
                      </span>
                    )}
                  </h2>
                  {vm.player.email && (
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {vm.player.email}
                    </p>
                  )}
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-sm border border-pitch-200 bg-pitch-50 px-2.5 py-1 text-xs font-bold text-pitch-800">
                  <Shield className="h-3.5 w-3.5" />
                  {ROLE_LABELS[vm.player.role]}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-paper p-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    {vm.activeSeasonName}
                  </span>
                  {vm.annualRow ? (
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <span className="font-display text-3xl font-extrabold text-pitch-800">
                          #{vm.annualRow.position}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-ink-muted">
                          ({vm.annualRow.pg}G-{vm.annualRow.pe}E-
                          {vm.annualRow.pp}P · {vm.annualRow.pj} PJ)
                        </span>
                      </div>
                      <span className="font-display text-2xl font-extrabold text-leather-700">
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
                        <span className="font-display text-3xl font-extrabold text-ink">
                          #{vm.historicalRow.position}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-ink-muted">
                          ({vm.historicalRow.pj} PJ · {vm.historicalRow.mvps}{" "}
                          MVPs)
                        </span>
                      </div>
                      <span className="font-display text-2xl font-extrabold text-pitch-800">
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

            {/* Official Titles & Stars */}
            <aside className="rounded-lg border border-rule bg-surface p-4">
              <h3 className="font-display flex items-center gap-2 border-b border-rule pb-2 text-lg font-bold tracking-wide text-ink">
                <Trophy className="h-4 w-4 text-gold-600" />
                Palmarés y Estrellas ({vm.titles.length})
              </h3>
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
                        <Star className="h-4 w-4 shrink-0 fill-gold-500 text-gold-600" />
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

          {/* Recent Matches Played */}
          <section className="rounded-lg border border-rule bg-surface p-4">
            <div className="mb-3 flex items-center justify-between border-b border-rule pb-2">
              <h3 className="font-display text-lg font-bold tracking-wide text-ink">
                Mis Últimos Partidos ({vm.recentMatches.length})
              </h3>
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
