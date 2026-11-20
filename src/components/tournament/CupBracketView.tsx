"use client";

import { Trophy } from "lucide-react";
import { getCupTieAggregate, resolveCupTieWinner } from "@/lib/engine";
import type { CupTie, Match, Player } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

interface CupBracketViewProps {
  ties: CupTie[];
  players: Player[];
  matches: Match[];
  editionName: string;
}

const ROUND_LABELS: Record<string, string> = {
  preliminary: "Fase Previa",
  quarterfinal: "Cuartos de Final",
  semifinal: "Semifinales",
  final: "Final de Copa",
  lolonmebol: "Final LOLONMEBOL",
};

const ROUND_ORDER = ["preliminary", "quarterfinal", "semifinal", "final", "lolonmebol"] as const;

export function CupBracketView({
  ties,
  players,
  matches,
  editionName,
}: CupBracketViewProps) {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const nameOf = (id: string | null) =>
    id ? playerMap.get(id)?.displayName ?? id : "Por definir";

  if (ties.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-pitch-700/25 bg-white p-6 text-center text-sm text-slate-500">
        Todavía no se generó el cuadro de {editionName}. Un Admin puede generarlo automáticamente desde el Panel Admin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-gold-400" />
          <div>
            <h3 className="text-sm font-black tracking-tight">{editionName}</h3>
            <p className="text-[11px] text-navy-100">
              Eliminación directa ida y vuelta · Ventaja deportiva en empate global
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ROUND_ORDER.map((round) => {
          const roundTies = ties
            .filter((t) => t.round === round)
            .sort((a, b) => a.slotOrder - b.slotOrder);
          if (roundTies.length === 0) return null;

          return (
            <div
              key={round}
              className="rounded-2xl border border-pitch-700/15 bg-white p-3.5 shadow-xs"
            >
              <h4 className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2 text-xs font-extrabold uppercase tracking-wider text-pitch-800">
                <span>{ROUND_LABELS[round]}</span>
                <span className="rounded-full bg-pitch-50 px-2 py-0.5 text-[10px] font-bold text-pitch-700">
                  {roundTies.length} {roundTies.length === 1 ? "llave" : "llaves"}
                </span>
              </h4>

              <div className="space-y-2.5">
                {roundTies.map((tie) => {
                  const agg = getCupTieAggregate(tie, matches);
                  const winnerId = resolveCupTieWinner(tie, matches);
                  const isAWin = Boolean(winnerId && winnerId === tie.playerAId);
                  const isBWin = Boolean(winnerId && winnerId === tie.playerBId);

                  return (
                    <div
                      key={tie.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-xs",
                          isAWin && "bg-pitch-50 font-bold text-pitch-900"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {tie.seedA && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-navy-800 text-[10px] font-bold text-white">
                              {tie.seedA}
                            </span>
                          )}
                          <span>{nameOf(tie.playerAId)}</span>
                        </div>
                        <span className="font-mono text-sm font-black text-navy-900">
                          {agg.hasScores ? agg.scoreA : "—"}
                        </span>
                      </div>

                      <div className="h-px bg-slate-200" />

                      <div
                        className={cn(
                          "flex items-center justify-between px-3 py-2 text-xs",
                          isBWin && "bg-pitch-50 font-bold text-pitch-900"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {tie.seedB && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-600 text-[10px] font-bold text-white">
                              {tie.seedB}
                            </span>
                          )}
                          <span>
                            {tie.playerBId
                              ? nameOf(tie.playerBId)
                              : round === "quarterfinal" && tie.slotOrder === 1
                                ? "Ganador Fase Previa"
                                : "Por definir"}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-black text-navy-900">
                          {agg.hasScores ? agg.scoreB : "—"}
                        </span>
                      </div>

                      {tie.notes && (
                        <div className="border-t border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-500">
                          {tie.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
