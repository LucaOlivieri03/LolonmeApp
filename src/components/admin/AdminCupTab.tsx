"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { resolveDefaultSeasonId } from "@/lib/engine";
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

  const [selectedSeasonId, setSeasonId] = useState(() =>
    resolveDefaultSeasonId(dataset.seasons)
  );
  const seasonId = resolveDefaultSeasonId(sortedSeasons, selectedSeasonId);
  const [finalist1, setFinalist1] = useState("b-aguzzi");
  const [finalist2, setFinalist2] = useState("pipo");

  const edition = dataset.cupEditions.find((e) => e.seasonId === seasonId);
  const ties = dataset.cupTies.filter((t) => t.cupEditionId === edition?.id);

  const playerOptions = useMemo(
    () =>
      dataset.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      })),
    [dataset.players]
  );

  const tiePlayerOptions = useMemo(
    () => [
      { id: "", displayName: "— Sin asignar —", subtitle: "Vacante" },
      ...playerOptions,
    ],
    [playerOptions]
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-wide text-ink">
                Editor Manual de Copa
              </h2>
              <p className="text-xs text-ink-muted">
                Generá el cuadro automático por tabla o editá jugadores, puntajes globales y ganadores por baja o reemplazo.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Temporada de Copa">
            {sortedSeasons.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeasonId(s.id)}
                className={cn(
                  "font-display min-h-10 rounded-md border px-3.5 text-base font-bold transition-colors",
                  seasonId === s.id
                    ? "border-leather-600 bg-leather-600 text-white"
                    : "border-rule bg-paper text-ink-muted hover:text-ink"
                )}
              >
                {s.year}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule pt-4">
          <div className="min-w-[200px] flex-1">
            <PlayerCombobox
              label="Finalista LOLONMEBOL ant. #1"
              options={playerOptions}
              value={finalist1}
              onChange={setFinalist1}
              placeholder="Elegir finalista #1..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <PlayerCombobox
              label="Finalista LOLONMEBOL ant. #2"
              options={playerOptions}
              value={finalist2}
              onChange={setFinalist2}
              placeholder="Elegir finalista #2..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>
          <button
            type="button"
            onClick={() => regenerateCupBracket(seasonId, [finalist1, finalist2])}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
          >
            <RefreshCw className="h-4 w-4" />
            Generar / Regenerar Cuadro
          </button>
        </div>
      </section>

      {ties.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center text-sm text-ink-muted">
          No hay llaves generadas para esta temporada. Usá &ldquo;Generar / Regenerar Cuadro&rdquo; arriba.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-surface divide-y divide-rule">
          {ties.map((tie) => (
            <div key={tie.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display rounded-sm border border-pitch-200 bg-pitch-50 px-2.5 py-0.5 text-sm font-bold uppercase tracking-wider text-pitch-800">
                  {ROUND_LABELS[tie.round]} #{tie.slotOrder}
                </span>
                <span className="text-xs font-medium text-ink-muted">
                  Seeds: {tie.seedA ?? "—"} vs {tie.seedB ?? "—"}
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PlayerCombobox
                      options={tiePlayerOptions}
                      value={tie.playerAId ?? ""}
                      onChange={(id) =>
                        updateCupTie(tie.id, { playerAId: id || null })
                      }
                      placeholder="— Jugador A —"
                      searchPlaceholder="Buscar Jugador A..."
                    />
                  </div>
                  <input
                    type="number"
                    aria-label="Global Jugador A"
                    placeholder="Glob A"
                    value={tie.overrideScoreA ?? ""}
                    onChange={(e) =>
                      updateCupTie(tie.id, {
                        overrideScoreA:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="font-display min-h-11 w-20 rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PlayerCombobox
                      options={tiePlayerOptions}
                      value={tie.playerBId ?? ""}
                      onChange={(id) =>
                        updateCupTie(tie.id, { playerBId: id || null })
                      }
                      placeholder="— Jugador B —"
                      searchPlaceholder="Buscar Jugador B..."
                    />
                  </div>
                  <input
                    type="number"
                    aria-label="Global Jugador B"
                    placeholder="Glob B"
                    value={tie.overrideScoreB ?? ""}
                    onChange={(e) =>
                      updateCupTie(tie.id, {
                        overrideScoreB:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="font-display min-h-11 w-20 rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink"
                  />
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <select
                  aria-label="Override ganador"
                  value={tie.winnerPlayerId ?? ""}
                  onChange={(e) =>
                    updateCupTie(tie.id, {
                      winnerPlayerId: e.target.value || null,
                    })
                  }
                  className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
                >
                  <option value="">Ganador automático (global / ventaja)</option>
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
                  aria-label="Nota de la llave"
                  placeholder="Nota (ej. Baja por lesión, ingresa reemplazo)"
                  value={tie.notes ?? ""}
                  onChange={(e) =>
                    updateCupTie(tie.id, { notes: e.target.value || null })
                  }
                  className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink placeholder:text-ink-muted sm:text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
