"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { cn } from "@/lib/utils";

const ROUND_LABELS: Record<string, string> = {
  preliminary: "Fase Previa",
  quarterfinal: "Cuartos de Final",
  semifinal: "Semifinales",
  final: "Final de Copa",
  lolonmebol: "Final LOLONMEBOL",
};

export function AdminCupTab() {
  const { dataset, updateCupTie, regenerateCupBracket } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [seasonId, setSeasonId] = useState(sortedSeasons[0]?.id ?? "season-2026");
  const [finalist1, setFinalist1] = useState("b-aguzzi");
  const [finalist2, setFinalist2] = useState("pipo");

  const edition = dataset.cupEditions.find((e) => e.seasonId === seasonId);
  const ties = dataset.cupTies.filter((t) => t.cupEditionId === edition?.id);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gold-600" />
            <div>
              <h2 className="text-sm font-black text-navy-900">
                Editor Manual de Copa (100% Editable)
              </h2>
              <p className="text-[11px] text-slate-500">
                Generá el cuadro automático por tabla o editá jugadores, puntajes globales y ganadores por baja/reemplazo.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {sortedSeasons.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeasonId(s.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-bold",
                  seasonId === s.id
                    ? "border-navy-800 bg-navy-800 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {s.year}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500">
              Finalista LOLONMEBOL ant. #1
            </label>
            <select
              value={finalist1}
              onChange={(e) => setFinalist1(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-navy-900"
            >
              {dataset.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500">
              Finalista LOLONMEBOL ant. #2
            </label>
            <select
              value={finalist2}
              onChange={(e) => setFinalist2(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-navy-900"
            >
              {dataset.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => regenerateCupBracket(seasonId, [finalist1, finalist2])}
            className="inline-flex items-center gap-1.5 rounded-xl bg-pitch-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-pitch-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generar / Regenerar Cuadro
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {ties.map((tie) => (
          <div
            key={tie.id}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-navy-800">
                {ROUND_LABELS[tie.round]} #{tie.slotOrder}
              </span>
              <span className="text-[11px] text-slate-400">
                Seeds: {tie.seedA ?? "—"} vs {tie.seedB ?? "—"}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <select
                  value={tie.playerAId ?? ""}
                  onChange={(e) =>
                    updateCupTie(tie.id, { playerAId: e.target.value || null })
                  }
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-navy-900"
                >
                  <option value="">-- Jugador A --</option>
                  {dataset.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Glob A"
                  value={tie.overrideScoreA ?? ""}
                  onChange={(e) =>
                    updateCupTie(tie.id, {
                      overrideScoreA:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center font-mono text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={tie.playerBId ?? ""}
                  onChange={(e) =>
                    updateCupTie(tie.id, { playerBId: e.target.value || null })
                  }
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-navy-900"
                >
                  <option value="">-- Jugador B --</option>
                  {dataset.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Glob B"
                  value={tie.overrideScoreB ?? ""}
                  onChange={(e) =>
                    updateCupTie(tie.id, {
                      overrideScoreB:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center font-mono text-xs font-bold"
                />
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <select
                value={tie.winnerPlayerId ?? ""}
                onChange={(e) =>
                  updateCupTie(tie.id, {
                    winnerPlayerId: e.target.value || null,
                  })
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
              >
                <option value="">Ganador automático (por global / ventaja)</option>
                {tie.playerAId && (
                  <option value={tie.playerAId}>
                    Override ganador:{" "}
                    {dataset.players.find((p) => p.id === tie.playerAId)?.displayName}
                  </option>
                )}
                {tie.playerBId && (
                  <option value={tie.playerBId}>
                    Override ganador:{" "}
                    {dataset.players.find((p) => p.id === tie.playerBId)?.displayName}
                  </option>
                )}
              </select>

              <input
                type="text"
                placeholder="Nota (ej. Baja por lesión, ingresa reemplazo)"
                value={tie.notes ?? ""}
                onChange={(e) =>
                  updateCupTie(tie.id, { notes: e.target.value || null })
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
