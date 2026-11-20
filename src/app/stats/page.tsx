"use client";

import { useMemo, useState } from "react";
import { BarChart3, FlaskConical, Search, Star, Swords, User, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTournament } from "@/components/providers/TournamentProvider";
import {
  computePairwiseStats,
  computeStandings,
  computeSubgroupStats,
} from "@/lib/engine";
import type { MatchModality } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

type StatsTab = "profile" | "lab";

export default function StatsPage() {
  const { dataset } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [tab, setTab] = useState<StatsTab>("lab");
  const [seasonId, setSeasonId] = useState<string>("ALL");
  const [modality, setModality] = useState<MatchModality | "ALL">("ALL");
  const [showEffectiveness310, setShowEffectiveness310] = useState(false);
  const [labSearch, setLabSearch] = useState("");

  const historicalStandings = useMemo(
    () =>
      computeStandings({
        players: dataset.players,
        matches: dataset.matches,
        titles: dataset.titles,
      }),
    [dataset]
  );

  const activePlayers = useMemo(
    () => historicalStandings.rows.filter((r) => r.totalPjAllMatches >= 3),
    [historicalStandings]
  );

  const filteredLabPlayers = useMemo(() => {
    const q = labSearch.trim().toLowerCase();
    if (!q) return activePlayers;
    return activePlayers.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [activePlayers, labSearch]);

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    activePlayers[0]?.playerId ?? dataset.players[0]?.id ?? ""
  );

  const [labPlayerIds, setLabPlayerIds] = useState<string[]>(() =>
    activePlayers.slice(0, 2).map((p) => p.playerId)
  );

  const filter = useMemo(
    () => ({
      seasonId: seasonId === "ALL" ? undefined : seasonId,
      modality,
    }),
    [seasonId, modality]
  );

  const profileRow = useMemo(() => {
    const standings = computeStandings({
      players: dataset.players,
      matches: dataset.matches,
      titles: dataset.titles,
      seasonId: seasonId === "ALL" ? undefined : seasonId,
    });
    return standings.rows.find((r) => r.playerId === selectedProfileId) ?? null;
  }, [dataset, seasonId, selectedProfileId]);

  const profilePairings = useMemo(() => {
    if (!selectedProfileId) return { bestTeammates: [], topRivals: [] };
    const others = activePlayers.filter((p) => p.playerId !== selectedProfileId);
    const pairs = others.map((o) => ({
      player: o,
      stats: computePairwiseStats(
        selectedProfileId,
        o.playerId,
        dataset.matches,
        filter
      ),
    }));

    const bestTeammates = [...pairs]
      .filter((x) => x.stats.matchesTogether >= 3)
      .sort((a, b) => b.stats.wilsonCtPct - a.stats.wilsonCtPct)
      .slice(0, 6);

    const topRivals = [...pairs]
      .filter((x) => x.stats.matchesAgainst >= 3)
      .sort((a, b) => Math.abs(b.stats.h2hBalance) - Math.abs(a.stats.h2hBalance))
      .slice(0, 6);

    return { bestTeammates, topRivals };
  }, [selectedProfileId, activePlayers, dataset.matches, filter]);

  const toggleLabPlayer = (id: string) => {
    setLabPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const labPairwise = useMemo(() => {
    if (labPlayerIds.length !== 2) return null;
    return computePairwiseStats(
      labPlayerIds[0],
      labPlayerIds[1],
      dataset.matches,
      filter
    );
  }, [labPlayerIds, dataset.matches, filter]);

  const labSubgroup = useMemo(() => {
    if (labPlayerIds.length < 2) return null;
    return computeSubgroupStats(labPlayerIds, dataset.matches, filter);
  }, [labPlayerIds, dataset.matches, filter]);

  const playerMap = useMemo(
    () => new Map(dataset.players.map((p) => [p.id, p])),
    [dataset.players]
  );

  const labChartData = useMemo(() => {
    if (!labSubgroup) return [];
    const items = [
      {
        name: "Química",
        value: Number(labSubgroup.chemistryPct.toFixed(1)),
        fill: "#0a4a28",
      },
      {
        name: "Wilson CT%",
        value: Number(labSubgroup.wilsonCtPct.toFixed(1)),
        fill: "#c86e0e",
      },
    ];
    if (showEffectiveness310) {
      items.push({
        name: "Efect. 3/1/0",
        value: Number(labSubgroup.effectiveness310Pct.toFixed(1)),
        fill: "#163963",
      });
    }
    return items;
  }, [labSubgroup, showEffectiveness310]);

  const teammatesChartData = useMemo(
    () =>
      profilePairings.bestTeammates.map(({ player, stats }) => ({
        name: player.displayName,
        wilson: Number(stats.wilsonCtPct.toFixed(1)),
        quimica: Number(stats.chemistryPct.toFixed(1)),
        pj: stats.matchesTogether,
      })),
    [profilePairings.bestTeammates]
  );

  const rivalsChartData = useMemo(
    () =>
      profilePairings.topRivals.map(({ player, stats }) => ({
        name: player.displayName,
        balance: stats.h2hBalance,
        record: `${stats.winsA}G-${stats.drawsAgainst}E-${stats.winsB}P`,
      })),
    [profilePairings.topRivals]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
            <BarChart3 className="h-6 w-6 text-pitch-700" />
            Estadísticas y Lab Grupal
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Química (%), Consistencia Wilson (z = 1.28) e Historial mano a mano
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Modo de estadísticas"
          className="inline-flex rounded-md border border-rule bg-surface p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lab"}
            onClick={() => setTab("lab")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3.5 text-sm font-semibold transition-colors",
              tab === "lab"
                ? "bg-pitch-800 text-white"
                : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
            )}
          >
            <FlaskConical className="h-4 w-4" />
            Lab Grupal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "profile"}
            onClick={() => setTab("profile")}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3.5 text-sm font-semibold transition-colors",
              tab === "profile"
                ? "bg-pitch-800 text-white"
                : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
            )}
          >
            <User className="h-4 w-4" />
            Perfil
          </button>
        </div>
      </header>

      {/* Shared Filters */}
      <section
        aria-label="Filtros de estadísticas"
        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-surface p-3.5"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Temporada
          </span>
          <button
            type="button"
            onClick={() => setSeasonId("ALL")}
            className={cn(
              "min-h-10 rounded-md border px-3 text-sm font-semibold transition-colors",
              seasonId === "ALL"
                ? "border-leather-600 bg-leather-600 text-white"
                : "border-rule bg-paper text-ink-muted hover:text-ink"
            )}
          >
            Histórico
          </button>
          {sortedSeasons.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeasonId(s.id)}
              className={cn(
                "font-display min-h-10 rounded-md border px-3 text-base font-bold transition-colors",
                seasonId === s.id
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-paper text-ink-muted hover:text-ink"
              )}
            >
              {s.year}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Modalidad
          </span>
          {(["ALL", "F5", "F6", "F7"] as const).map((mod) => (
            <button
              key={mod}
              type="button"
              onClick={() => setModality(mod)}
              className={cn(
                "min-h-10 rounded-md border px-3 text-sm font-semibold transition-colors",
                modality === mod
                  ? "border-pitch-800 bg-pitch-800 text-white"
                  : "border-rule bg-paper text-ink-muted hover:text-ink"
              )}
            >
              {mod === "ALL" ? "Todas" : mod}
            </button>
          ))}
        </div>

        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={showEffectiveness310}
            onChange={(e) => setShowEffectiveness310(e.target.checked)}
            className="h-4 w-4 rounded-sm accent-pitch-800"
          />
          Efectividad 3/1/0
        </label>
      </section>

      {tab === "lab" ? (
        <div className="space-y-4">
          <section className="rounded-lg border border-rule bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
                <Users className="h-4 w-4 text-pitch-700" />
                Elegí 2 o más jugadores ({labPlayerIds.length} seleccionados)
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="search"
                    value={labSearch}
                    onChange={(e) => setLabSearch(e.target.value)}
                    placeholder="Buscar jugador..."
                    className="min-h-10 w-44 rounded-md border border-rule bg-paper pr-3 pl-8 text-base text-ink placeholder:text-ink-muted sm:w-52 sm:text-sm"
                  />
                </div>
                {labPlayerIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setLabPlayerIds([])}
                    className="min-h-10 rounded-md border border-crimson-600/30 bg-crimson-50 px-3 text-xs font-bold text-crimson-700 transition-colors hover:bg-crimson-100"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {filteredLabPlayers.map((p) => {
                const selected = labPlayerIds.includes(p.playerId);
                return (
                  <button
                    key={p.playerId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleLabPlayer(p.playerId)}
                    className={cn(
                      "min-h-10 rounded-md border px-3 text-sm font-semibold transition-colors",
                      selected
                        ? "border-pitch-800 bg-pitch-800 text-white"
                        : "border-rule bg-paper text-ink hover:border-pitch-700"
                    )}
                  >
                    {p.displayName}
                  </button>
                );
              })}
            </div>
          </section>

          {labPlayerIds.length < 2 ? (
            <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center text-sm text-ink-muted">
              Seleccioná al menos 2 jugadores para calcular Química, Consistencia Wilson e Historial mano a mano.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {labSubgroup && (
                <section className="flex flex-col justify-between rounded-lg border border-rule bg-surface p-4">
                  <div>
                    <h3 className="font-display border-b border-rule pb-2 text-lg font-bold tracking-wide text-pitch-800">
                      Jugando Juntos ·{" "}
                      {labPlayerIds
                        .map((id) => playerMap.get(id)?.displayName)
                        .join(" + ")}
                    </h3>

                    <dl className="mt-3 grid grid-cols-3 divide-x divide-rule rounded-md border border-rule bg-paper">
                      <div className="px-3 py-2.5 text-center">
                        <dt className="text-xs font-semibold text-ink-muted">Química</dt>
                        <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800">
                          {labSubgroup.chemistryPct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <dt className="text-xs font-semibold text-ink-muted">Wilson CT%</dt>
                        <dd className="font-display mt-0.5 text-2xl font-extrabold text-leather-700">
                          {labSubgroup.wilsonCtPct.toFixed(1)}%
                        </dd>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <dt className="text-xs font-semibold text-ink-muted">
                          PJ ({labSubgroup.wins}-{labSubgroup.draws}-{labSubgroup.losses})
                        </dt>
                        <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink">
                          {labSubgroup.matchesPlayed}
                        </dd>
                      </div>
                    </dl>

                    {labSubgroup.matchesPlayed > 0 && (
                      <div className="mt-4 h-36 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={labChartData}
                            layout="vertical"
                            margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                          >
                            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#4c5d52" }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={82}
                              tick={{ fontSize: 12, fill: "#111c15", fontWeight: 600 }}
                            />
                            <Tooltip
                              formatter={(val) => [`${val}%`, "Índice"]}
                              contentStyle={{
                                backgroundColor: "#ffffff",
                                borderColor: "#d6d3c7",
                                borderRadius: "6px",
                                fontSize: "12px",
                              }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                              {labChartData.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {showEffectiveness310 && (
                    <p className="mt-3 border-t border-rule pt-2.5 text-xs text-ink-muted">
                      Efectividad unificada 3/1/0:{" "}
                      <strong className="text-ink">
                        {labSubgroup.effectiveness310Pct.toFixed(1)}%
                      </strong>
                    </p>
                  )}
                </section>
              )}

              {labPairwise && (
                <section className="flex flex-col justify-between rounded-lg border border-rule bg-surface p-4">
                  <div>
                    <h3 className="font-display flex items-center gap-2 border-b border-rule pb-2 text-lg font-bold tracking-wide text-ink">
                      <Swords className="h-4 w-4 text-crimson-600" />
                      Historial Mano a Mano (Rivales)
                    </h3>

                    <div className="pitch-chalk-surface mt-4 flex items-center justify-between rounded-md border border-pitch-900 px-5 py-4 text-paper">
                      <div className="min-w-0 flex-1 text-center">
                        <span className="block truncate text-xs font-semibold text-pitch-100">
                          {playerMap.get(labPairwise.playerAId)?.displayName}
                        </span>
                        <span className="font-display mt-1 block text-4xl font-extrabold text-gold-400">
                          {labPairwise.winsA}
                        </span>
                      </div>

                      <div className="px-3 text-center">
                        <span className="block text-xs font-semibold text-pitch-200">
                          Empates: {labPairwise.drawsAgainst}
                        </span>
                        <span className="font-display mt-1 inline-block rounded-sm bg-pitch-900/80 px-2.5 py-0.5 text-sm font-bold text-white">
                          Dif:{" "}
                          {labPairwise.h2hBalance > 0
                            ? `+${labPairwise.h2hBalance}`
                            : labPairwise.h2hBalance}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 text-center">
                        <span className="block truncate text-xs font-semibold text-pitch-100">
                          {playerMap.get(labPairwise.playerBId)?.displayName}
                        </span>
                        <span className="font-display mt-1 block text-4xl font-extrabold text-gold-400">
                          {labPairwise.winsB}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-center text-xs text-ink-muted">
                    {labPairwise.matchesAgainst} partidos enfrentados en equipos rivales
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-lg border border-rule bg-surface p-4">
            <label
              htmlFor="profile-player-select"
              className="block text-xs font-bold uppercase tracking-wider text-ink-muted"
            >
              Seleccionar Jugador
            </label>
            <select
              id="profile-player-select"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:max-w-sm"
            >
              {activePlayers.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.displayName} ({p.points} pts hist.)
                </option>
              ))}
            </select>

            {profileRow && (
              <div className="mt-4 space-y-3">
                <div className="pitch-chalk-surface flex flex-wrap items-center justify-between gap-3 rounded-md border border-pitch-900 px-4 py-3.5 text-paper">
                  <div>
                    <h2 className="font-display flex items-center gap-2 text-2xl font-extrabold tracking-wide text-white">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-gold-500 text-sm font-extrabold text-ink">
                        #{profileRow.position}
                      </span>
                      {profileRow.displayName}
                      {profileRow.stars > 0 && (
                        <span className="inline-flex gap-0.5">
                          {Array.from({ length: profileRow.stars }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4 fill-gold-400 text-gold-400"
                            />
                          ))}
                        </span>
                      )}
                    </h2>
                    <p className="mt-0.5 text-xs text-pitch-100">
                      {profileRow.pg}G · {profileRow.pe}E · {profileRow.pp}P ({profileRow.pj} PJ en tabla)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-display block text-3xl font-extrabold text-gold-400">
                      {profileRow.points}
                    </span>
                    <span className="text-xs font-semibold text-pitch-100">
                      Puntos
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 divide-x divide-y divide-rule rounded-md border border-rule bg-paper sm:grid-cols-4 sm:divide-y-0">
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">PG%</dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink">
                      {profileRow.winRate.toFixed(0)}%
                    </dd>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">MVPs</dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-leather-700">
                      {profileRow.mvps}
                    </dd>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">
                      G/A ({profileRow.goalContributions})
                    </dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-ink">
                      {profileRow.goals}G / {profileRow.assists}A
                    </dd>
                  </div>
                  <div className="px-3 py-3 text-center">
                    <dt className="text-xs font-semibold text-ink-muted">Calif. Prom</dt>
                    <dd className="font-display mt-0.5 text-2xl font-extrabold text-pitch-800">
                      {profileRow.avgRating !== null
                        ? profileRow.avgRating.toFixed(2)
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-rule bg-surface p-4">
              <h3 className="font-display mb-3 border-b border-rule pb-2 text-lg font-bold tracking-wide text-pitch-800">
                Mejores Socios (Wilson CT%)
              </h3>
              {teammatesChartData.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Se necesitan al menos 3 partidos juntos con este filtro para calcular socios.
                </p>
              ) : (
                <>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={teammatesChartData}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                      >
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#4c5d52" }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={96}
                          tick={{ fontSize: 12, fill: "#111c15", fontWeight: 600 }}
                        />
                        <Tooltip
                          formatter={(val, key) => [
                            `${val}%`,
                            key === "wilson" ? "Wilson CT%" : "Química",
                          ]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderColor: "#d6d3c7",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="wilson" fill="#0a4a28" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 divide-y divide-rule text-xs">
                    {profilePairings.bestTeammates.map(({ player, stats }) => (
                      <li
                        key={player.playerId}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="font-semibold text-ink">
                          {player.displayName}{" "}
                          <span className="font-normal text-ink-muted">
                            ({stats.matchesTogether} PJ)
                          </span>
                        </span>
                        <span className="font-display text-sm font-bold text-pitch-800">
                          CT {stats.wilsonCtPct.toFixed(1)}% · Q {stats.chemistryPct.toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="rounded-lg border border-rule bg-surface p-4">
              <h3 className="font-display mb-3 border-b border-rule pb-2 text-lg font-bold tracking-wide text-ink">
                Historial vs Rivales (V − D)
              </h3>
              {rivalsChartData.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Se necesitan al menos 3 enfrentamientos como rivales con este filtro.
                </p>
              ) : (
                <>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rivalsChartData}
                        layout="vertical"
                        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                      >
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#4c5d52" }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={96}
                          tick={{ fontSize: 12, fill: "#111c15", fontWeight: 600 }}
                        />
                        <ReferenceLine x={0} stroke="#b8b4a5" />
                        <Tooltip
                          formatter={(val) => [
                            Number(val) > 0 ? `+${val}` : `${val}`,
                            "Balance V − D",
                          ]}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderColor: "#d6d3c7",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="balance" radius={[3, 3, 3, 3]} barSize={16}>
                          {rivalsChartData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={
                                entry.balance > 0
                                  ? "#0a4a28"
                                  : entry.balance < 0
                                    ? "#c4202b"
                                    : "#b8b4a5"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 divide-y divide-rule text-xs">
                    {profilePairings.topRivals.map(({ player, stats }) => (
                      <li
                        key={player.playerId}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="font-semibold text-ink">
                          vs {player.displayName}{" "}
                          <span className="font-normal text-ink-muted">
                            ({stats.winsA}G-{stats.drawsAgainst}E-{stats.winsB}P)
                          </span>
                        </span>
                        <span
                          className={cn(
                            "font-display rounded-sm px-2 py-0.5 text-sm font-bold",
                            stats.h2hBalance > 0
                              ? "bg-pitch-50 text-pitch-800"
                              : stats.h2hBalance < 0
                                ? "bg-crimson-50 text-crimson-700"
                                : "bg-surface-subtle text-ink-muted"
                          )}
                        >
                          {stats.h2hBalance > 0
                            ? `+${stats.h2hBalance}`
                            : stats.h2hBalance}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
