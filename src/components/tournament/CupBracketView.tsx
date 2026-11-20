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
  quarterfinal: "Cuartos",
  semifinal: "Semifinales",
  final: "Final de Copa",
  lolonmebol: "Final LOLONMEBOL",
};

const ROUND_ORDER = [
  "preliminary",
  "quarterfinal",
  "semifinal",
  "final",
  "lolonmebol",
] as const;

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
      <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-ink">
          Todavía no se generó el cuadro de {editionName}.
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Un Admin puede generarlo automáticamente desde el Panel Admin en la pestaña Copa.
        </p>
      </div>
    );
  }

  const activeRounds = ROUND_ORDER.map((round) => ({
    round,
    ties: ties
      .filter((t) => t.round === round)
      .sort((a, b) => a.slotOrder - b.slotOrder),
  })).filter((r) => r.ties.length > 0);

  return (
    <div className="space-y-3">
      <div className="pitch-chalk-surface flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pitch-900 px-4 py-3 text-paper">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 shrink-0 text-gold-400" />
          <div>
            <h3 className="font-display text-xl font-bold tracking-wide text-white">
              {editionName}
            </h3>
            <p className="text-xs text-pitch-100">
              Eliminación directa ida y vuelta · Ventaja deportiva por tabla en empate global
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-pitch-200 sm:hidden">
          Deslizá para ver las llaves →
        </span>
      </div>

      {/* Horizontal Progression Bracket */}
      <div className="overflow-x-auto rounded-lg border border-rule bg-surface p-3.5 sm:p-4">
        <div className="flex min-w-max items-stretch gap-3 lg:min-w-0">
          {activeRounds.map(({ round, ties: roundTies }, roundIdx) => {
            const isSupercup = round === "lolonmebol";
            const isFinal = round === "final";
            const hasNextRound = roundIdx < activeRounds.length - 1;

            return (
              <div
                key={round}
                className="relative flex w-56 shrink-0 flex-col lg:min-w-0 lg:flex-1"
              >
                <div
                  className={cn(
                    "mb-3 flex items-center justify-between border-b pb-2",
                    isSupercup
                      ? "border-gold-500"
                      : isFinal
                        ? "border-leather-600"
                        : "border-rule"
                  )}
                >
                  <h4
                    className={cn(
                      "font-display text-base font-bold uppercase tracking-wider",
                      isSupercup
                        ? "text-gold-700"
                        : isFinal
                          ? "text-leather-700"
                          : "text-pitch-800"
                    )}
                  >
                    {ROUND_LABELS[round]}
                  </h4>
                  <span className="text-xs font-medium text-ink-muted">
                    {roundTies.length} {roundTies.length === 1 ? "llave" : "llaves"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-around gap-3">
                  {roundTies.map((tie) => {
                    const agg = getCupTieAggregate(tie, matches);
                    const winnerId = resolveCupTieWinner(tie, matches);
                    const isAWin = Boolean(winnerId && winnerId === tie.playerAId);
                    const isBWin = Boolean(winnerId && winnerId === tie.playerBId);

                    return (
                      <div key={tie.id} className="relative flex items-center">
                        <div
                          className={cn(
                            "w-full overflow-hidden rounded-md border bg-paper",
                            isSupercup
                              ? "border-gold-500 bg-gold-50/40"
                              : isFinal
                                ? "border-leather-600/50"
                                : "border-rule"
                          )}
                        >
                          <div
                            className={cn(
                              "flex items-center justify-between gap-2 px-3 py-2 text-sm",
                              isAWin
                                ? "bg-pitch-50 font-bold text-pitch-900"
                                : "bg-surface text-ink"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {tie.seedA && (
                                <span className="font-display inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-pitch-800 text-xs font-bold text-white">
                                  {tie.seedA}
                                </span>
                              )}
                              <span className="truncate">{nameOf(tie.playerAId)}</span>
                            </div>
                            <span className="font-display shrink-0 text-lg font-extrabold text-ink">
                              {agg.hasScores ? agg.scoreA : "—"}
                            </span>
                          </div>

                          <div className="h-px bg-rule" />

                          <div
                            className={cn(
                              "flex items-center justify-between gap-2 px-3 py-2 text-sm",
                              isBWin
                                ? "bg-pitch-50 font-bold text-pitch-900"
                                : "bg-surface text-ink"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {tie.seedB && (
                                <span className="font-display inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-surface-subtle text-xs font-bold text-ink-muted">
                                  {tie.seedB}
                                </span>
                              )}
                              <span className="truncate">
                                {tie.playerBId
                                  ? nameOf(tie.playerBId)
                                  : round === "quarterfinal" && tie.slotOrder === 1
                                    ? "Ganador Fase Previa"
                                    : "Por definir"}
                              </span>
                            </div>
                            <span className="font-display shrink-0 text-lg font-extrabold text-ink">
                              {agg.hasScores ? agg.scoreB : "—"}
                            </span>
                          </div>

                          {tie.notes && (
                            <div className="border-t border-rule bg-surface-subtle/60 px-3 py-1.5 text-xs text-ink-muted">
                              {tie.notes}
                            </div>
                          )}
                        </div>

                        {/* Horizontal connector stub to next round */}
                        {hasNextRound && (
                          <div
                            aria-hidden="true"
                            className="h-px w-3 shrink-0 bg-rule-strong"
                          />
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
    </div>
  );
}
