"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  LogIn,
  LogOut,
  Shield,
  Star,
  Trophy,
  UserCheck,
  UserCircle2,
} from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { computeStandings, resolveDefaultSeasonId } from "@/lib/engine";
import type { PlayerRole, TitleType } from "@/lib/types/domain";
import { cn, formatDateEs } from "@/lib/utils";

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

export default function PerfilPage() {
  const {
    dataset,
    role,
    loggedPlayerId,
    isLocalMode,
    setRole,
    setLoggedPlayerId,
  } = useTournament();

  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const activeSeasonId = resolveDefaultSeasonId(sortedSeasons);
  const activeSeason = sortedSeasons.find((s) => s.id === activeSeasonId);

  const historicalStandings = useMemo(
    () =>
      computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
      }),
    [dataset]
  );

  const annualStandings = useMemo(
    () =>
      computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
        seasonId: activeSeasonId || undefined,
      }),
    [dataset, activeSeasonId]
  );

  const isGuest = role === "guest" || !loggedPlayerId;

  const linkedPlayer = useMemo(
    () => dataset.players.find((p) => p.id === loggedPlayerId) ?? null,
    [dataset.players, loggedPlayerId]
  );

  const historicalRow = useMemo(
    () =>
      historicalStandings.rows.find((r) => r.playerId === loggedPlayerId) ??
      null,
    [historicalStandings, loggedPlayerId]
  );

  const annualRow = useMemo(
    () =>
      annualStandings.rows.find((r) => r.playerId === loggedPlayerId) ?? null,
    [annualStandings, loggedPlayerId]
  );

  const playerTitles = useMemo(
    () => dataset.titles.filter((t) => t.playerId === loggedPlayerId),
    [dataset.titles, loggedPlayerId]
  );

  const recentMatches = useMemo(() => {
    if (!loggedPlayerId) return [];
    return dataset.matches
      .filter((m) => m.players.some((mp) => mp.playerId === loggedPlayerId))
      .slice(0, 6);
  }, [dataset.matches, loggedPlayerId]);

  const comboboxOptions = useMemo(() => {
    const histMap = new Map(
      historicalStandings.rows.map((r) => [r.playerId, r])
    );
    return dataset.players.map((p) => {
      const st = histMap.get(p.id);
      return {
        id: p.id,
        displayName: p.displayName,
        position: st?.position,
        points: st?.points ?? 0,
        pj: st?.pj ?? 0,
        stars: st?.stars ?? 0,
      };
    });
  }, [dataset.players, historicalStandings]);

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
                <strong className="text-gold-400">{ROLE_LABELS[role]}</strong>
                {linkedPlayer && !isGuest
                  ? ` · Vinculado a ${linkedPlayer.displayName}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isGuest ? (
              <button
                type="button"
                onClick={() => {
                  setRole("player");
                  if (!loggedPlayerId) {
                    setLoggedPlayerId(dataset.players[0]?.id ?? "b-aguzzi");
                  }
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-gold-400 px-3.5 text-xs font-extrabold text-ink transition-colors hover:bg-gold-500"
              >
                <LogIn className="h-4 w-4" />
                Iniciar Sesión
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRole("guest")}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-white/25 bg-pitch-900/70 px-3.5 text-xs font-bold text-pitch-50 transition-colors hover:bg-pitch-950"
              >
                <LogOut className="h-4 w-4" />
                Cerrar Sesión (Modo Invitado)
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Local / Session Switcher & Player Binding */}
      {isLocalMode && !isGuest && (
        <section className="rounded-lg border border-rule bg-surface p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <PlayerCombobox
                label="Jugador vinculado a tu cuenta (Simulador Local)"
                options={comboboxOptions}
                value={loggedPlayerId ?? ""}
                onChange={(id) => setLoggedPlayerId(id)}
                placeholder="Vincular jugador..."
                searchPlaceholder="Buscar tu jugador en el padrón..."
              />
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                Rol de tu sesión
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(["player", "authorized", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "min-h-11 rounded-md border px-3.5 text-xs font-bold transition-colors",
                      role === r
                        ? "border-pitch-800 bg-pitch-800 text-white"
                        : "border-rule bg-paper text-ink-muted hover:text-ink"
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isGuest || !linkedPlayer ? (
        <section className="rounded-lg border border-rule bg-surface p-6 text-center sm:p-8">
          <UserCheck className="mx-auto h-10 w-10 text-pitch-700" />
          <h2 className="font-display mt-3 text-2xl font-extrabold tracking-wide text-ink">
            Estás navegando como Invitado
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-ink-muted">
            Iniciá sesión para vincular tu cuenta con tu jugador del padrón oficial, ver tu resumen personal de temporada, tus estrellas y tu historial reciente.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs text-ink-muted">
            ¿Querés consultar las estadísticas individuales de cualquier jugador del torneo sin iniciar sesión? Usá el explorador público de{" "}
            <strong className="text-ink">Stats por Jugador</strong>.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setRole("player");
                setLoggedPlayerId(dataset.players[0]?.id ?? "b-aguzzi");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900"
            >
              <LogIn className="h-4 w-4" />
              Iniciar Sesión como Jugador
            </button>
            <Link
              href="/stats"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-rule bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-pitch-700"
            >
              <BarChart3 className="h-4 w-4 text-pitch-700" />
              Ir a Stats por Jugador
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Personal Federation Card */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-rule bg-surface p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-pitch-700">
                    Ficha Personal · Padrón LOLONMEBOL
                  </span>
                  <h2 className="font-display mt-0.5 flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
                    {linkedPlayer.displayName}
                    {(historicalRow?.stars ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: historicalRow?.stars ?? 0 }).map(
                          (_, i) => (
                            <Star
                              key={i}
                              className="h-5 w-5 fill-gold-500 text-gold-600"
                            />
                          )
                        )}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-ink-muted">
                    ID: <code className="font-mono">{linkedPlayer.id}</code>
                    {linkedPlayer.email ? ` · ${linkedPlayer.email}` : ""}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-sm border border-pitch-200 bg-pitch-50 px-2.5 py-1 text-xs font-bold text-pitch-800">
                  <Shield className="h-3.5 w-3.5" />
                  {ROLE_LABELS[role]}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-rule bg-paper p-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    {activeSeason?.name ?? "Temporada Actual"}
                  </span>
                  {annualRow ? (
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <span className="font-display text-3xl font-extrabold text-pitch-800">
                          #{annualRow.position}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-ink-muted">
                          ({annualRow.pg}G-{annualRow.pe}E-{annualRow.pp}P ·{" "}
                          {annualRow.pj} PJ)
                        </span>
                      </div>
                      <span className="font-display text-2xl font-extrabold text-leather-700">
                        {annualRow.points} pts
                      </span>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-muted">
                      Sin partidos computados en la temporada actual.
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-rule bg-paper p-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Tabla Histórica Acumulada
                  </span>
                  {historicalRow ? (
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <span className="font-display text-3xl font-extrabold text-ink">
                          #{historicalRow.position}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-ink-muted">
                          ({historicalRow.pj} PJ · {historicalRow.mvps} MVPs)
                        </span>
                      </div>
                      <span className="font-display text-2xl font-extrabold text-pitch-800">
                        {historicalRow.points} pts
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
                  href="/stats"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-pitch-800 px-3.5 text-xs font-bold text-white transition-colors hover:bg-pitch-900"
                >
                  <BarChart3 className="h-4 w-4" />
                  Explorar mis socios, rivales y gráficas en Stats
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {(role === "admin" || role === "authorized") && (
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
                Palmarés y Estrellas ({playerTitles.length})
              </h3>
              {playerTitles.length === 0 ? (
                <p className="py-6 text-xs leading-relaxed text-ink-muted">
                  Todavía no registrás títulos oficiales (Liga, Copa o Final LOLONMEBOL) en el palmarés histórico.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-rule text-xs">
                  {playerTitles.map((t) => (
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
                Mis Últimos Partidos ({recentMatches.length})
              </h3>
              <Link
                href="/partidos"
                className="text-xs font-bold text-pitch-800 hover:underline"
              >
                Ver historial completo
              </Link>
            </div>

            {recentMatches.length === 0 ? (
              <p className="py-4 text-sm text-ink-muted">
                No hay partidos registrados para este jugador.
              </p>
            ) : (
              <ul className="divide-y divide-rule text-sm">
                {recentMatches.map((m) => {
                  const mp = m.players.find(
                    (p) => p.playerId === loggedPlayerId
                  );
                  return (
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
                          · {formatDateEs(m.matchDate)} · Equipo {mp?.team}
                        </span>
                        {mp?.isMvp && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-leather-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            <Award className="h-3 w-3" />
                            MVP
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        {mp && (mp.goals > 0 || mp.assists > 0) && (
                          <span className="font-semibold text-ink">
                            {mp.goals}G / {mp.assists}A
                          </span>
                        )}
                        {mp?.adminRating !== null &&
                          mp?.adminRating !== undefined && (
                            <span className="font-display rounded-sm border border-pitch-200 bg-pitch-50 px-1.5 py-0.5 text-sm font-bold text-pitch-800">
                              {mp.adminRating.toFixed(1)}
                            </span>
                          )}
                        <span className="font-display rounded bg-pitch-800 px-2.5 py-1 text-sm font-extrabold text-white">
                          {m.teamAScore ?? "—"} – {m.teamBScore ?? "—"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
