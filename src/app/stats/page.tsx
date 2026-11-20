"use client";

import { useMemo, useState } from "react";
import { BarChart3, FlaskConical, Star, Swords, User, Users } from "lucide-react";
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
    () =>
      historicalStandings.rows.filter((r) => r.totalPjAllMatches >= 3),
    [historicalStandings]
  );

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-navy-900">
            <BarChart3 className="h-5 w-5 text-pitch-700" />
            Stats & Laboratorio Grupal
          </h1>
          <p className="text-xs text-slate-500">
            Química (%), Consistencia Wilson (z = 1.28) e Historial mano a mano
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-pitch-700/15 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setTab("lab")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold",
              tab === "lab"
                ? "bg-pitch-700 text-white"
                : "text-slate-600 hover:bg-pitch-50"
            )}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Lab Grupal
          </button>
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold",
              tab === "profile"
                ? "bg-pitch-700 text-white"
                : "text-slate-600 hover:bg-pitch-50"
            )}
          >
            <User className="h-3.5 w-3.5" />
            Perfil
          </button>
        </div>
      </div>

      {/* Shared Filters: Season + Modality + 3/1/0 Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-pitch-700/15 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Temporada:
          </span>
          <button
            type="button"
            onClick={() => setSeasonId("ALL")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-bold",
              seasonId === "ALL"
                ? "bg-navy-800 text-white"
                : "bg-slate-100 text-slate-600"
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
                "rounded-lg px-2.5 py-1 text-xs font-bold",
                seasonId === s.id
                  ? "bg-navy-800 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {s.year}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Modalidad:
          </span>
          {(["ALL", "F5", "F6", "F7"] as const).map((mod) => (
            <button
              key={mod}
              type="button"
              onClick={() => setModality(mod)}
              className={cn(
                "rounded-lg px-2 py-1 text-xs font-bold",
                modality === mod
                  ? "bg-pitch-700 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              {mod === "ALL" ? "Todas" : mod}
            </button>
          ))}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-navy-800">
          <input
            type="checkbox"
            checked={showEffectiveness310}
            onChange={(e) => setShowEffectiveness310(e.target.checked)}
            className="h-4 w-4 rounded-sm accent-pitch-700"
          />
          Mostrar Efectividad 3/1/0
        </label>
      </div>

      {tab === "lab" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-navy-800">
                <Users className="h-4 w-4 text-pitch-700" />
                Elegí 2 o más jugadores para analizar ({labPlayerIds.length} seleccionados)
              </h2>
              {labPlayerIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLabPlayerIds([])}
                  className="text-xs font-semibold text-crimson-600 hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activePlayers.map((p) => {
                const selected = labPlayerIds.includes(p.playerId);
                return (
                  <button
                    key={p.playerId}
                    type="button"
                    onClick={() => toggleLabPlayer(p.playerId)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                      selected
                        ? "border-pitch-700 bg-pitch-700 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-pitch-600"
                    )}
                  >
                    {p.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          {labPlayerIds.length < 2 ? (
            <div className="rounded-2xl border border-dashed border-pitch-700/25 bg-white p-6 text-center text-sm text-slate-500">
              Seleccioná al menos 2 jugadores para calcular Química, Consistencia Wilson e Historial H2H.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {labSubgroup && (
                <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-pitch-800">
                    Jugando Juntos ({labPlayerIds.map((id) => playerMap.get(id)?.displayName).join(" + ")})
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-pitch-50 p-3 text-center">
                      <span className="block text-xl font-black text-pitch-800">
                        {labSubgroup.chemistryPct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Química
                      </span>
                    </div>
                    <div className="rounded-xl bg-navy-50 p-3 text-center">
                      <span className="block text-xl font-black text-navy-800">
                        {labSubgroup.wilsonCtPct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Wilson CT%
                      </span>
                    </div>
                    <div className="rounded-xl bg-gold-100/70 p-3 text-center">
                      <span className="block text-xl font-black text-navy-900">
                        {labSubgroup.matchesPlayed}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-600">
                        PJ ({labSubgroup.wins}G-{labSubgroup.draws}E-{labSubgroup.losses}P)
                      </span>
                    </div>
                  </div>
                  {showEffectiveness310 && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      Efectividad 3/1/0:{" "}
                      <strong className="text-navy-900">
                        {labSubgroup.effectiveness310Pct.toFixed(1)}%
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {labPairwise && (
                <div className="rounded-2xl border border-navy-800/15 bg-white p-4 shadow-xs">
                  <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-navy-800">
                    <Swords className="h-4 w-4 text-crimson-600" />
                    Historial Mano a Mano (Rivales)
                  </h3>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3 text-white">
                    <div className="text-center">
                      <span className="block text-xs text-navy-100">
                        {playerMap.get(labPairwise.playerAId)?.displayName}
                      </span>
                      <span className="text-2xl font-black text-gold-400">
                        {labPairwise.winsA}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] uppercase text-navy-100">
                        Empates: {labPairwise.drawsAgainst}
                      </span>
                      <span className="mt-0.5 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
                        Dif: {labPairwise.h2hBalance > 0 ? `+${labPairwise.h2hBalance}` : labPairwise.h2hBalance}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="block text-xs text-navy-100">
                        {playerMap.get(labPairwise.playerBId)?.displayName}
                      </span>
                      <span className="text-2xl font-black text-gold-400">
                        {labPairwise.winsB}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    {labPairwise.matchesAgainst} partidos enfrentados en equipos rivales
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
            <label className="block text-xs font-bold uppercase text-slate-500">
              Seleccionar Jugador
            </label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-navy-900"
            >
              {activePlayers.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.displayName} ({p.points} pts hist.)
                </option>
              ))}
            </select>

            {profileRow && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-pitch-50 px-4 py-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-lg font-black text-navy-900">
                      {profileRow.displayName}
                      {profileRow.stars > 0 && (
                        <span className="inline-flex gap-0.5">
                          {Array.from({ length: profileRow.stars }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-4 w-4 fill-gold-500 text-gold-600"
                            />
                          ))}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-pitch-800">
                      Posición #{profileRow.position} · {profileRow.pg}G {profileRow.pe}E {profileRow.pp}P
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-black text-pitch-800">
                      {profileRow.points}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      Puntos
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <span className="block text-lg font-black text-navy-900">
                      {profileRow.winRate.toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      PG%
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <span className="block text-lg font-black text-navy-900">
                      {profileRow.mvps}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      MVPs
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <span className="block text-lg font-black text-navy-900">
                      {profileRow.goals}G / {profileRow.assists}A
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      G/A ({profileRow.goalContributions})
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <span className="block text-lg font-black text-navy-900">
                      {profileRow.avgRating !== null
                        ? profileRow.avgRating.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      Calif. Prom
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
              <h3 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-pitch-800">
                Mejores Socios (por Wilson CT%)
              </h3>
              <ul className="divide-y divide-slate-100 text-xs">
                {profilePairings.bestTeammates.map(({ player, stats }) => (
                  <li
                    key={player.playerId}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="font-semibold text-navy-900">
                      {player.displayName}{" "}
                      <span className="text-slate-400">
                        ({stats.matchesTogether} PJ)
                      </span>
                    </span>
                    <span className="font-mono font-bold text-pitch-800">
                      CT {stats.wilsonCtPct.toFixed(1)}% · Q{" "}
                      {stats.chemistryPct.toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-navy-800/15 bg-white p-4 shadow-xs">
              <h3 className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-navy-800">
                Historial Destacado vs Rivales (V - D)
              </h3>
              <ul className="divide-y divide-slate-100 text-xs">
                {profilePairings.topRivals.map(({ player, stats }) => (
                  <li
                    key={player.playerId}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="font-semibold text-navy-900">
                      vs {player.displayName}{" "}
                      <span className="text-slate-400">
                        ({stats.winsA}G-{stats.drawsAgainst}E-{stats.winsB}P)
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono font-bold",
                        stats.h2hBalance > 0
                          ? "bg-pitch-100 text-pitch-800"
                          : stats.h2hBalance < 0
                            ? "bg-red-100 text-crimson-600"
                            : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {stats.h2hBalance > 0
                        ? `+${stats.h2hBalance}`
                        : stats.h2hBalance}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
