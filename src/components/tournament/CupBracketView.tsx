"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import type { ResolvedCupTie } from "@/lib/types/view-models";
import { cn } from "@/lib/utils";

interface CupBracketViewProps {
  ties: ResolvedCupTie[];
  editionName: string;
}

const ROUND_LABELS: Record<string, string> = {
  preliminary: "Fase Previa",
  quarterfinal: "Cuartos",
  semifinal: "Semifinales",
  final: "Final de Copa",
  lolonmebol: "Final LOLONMEBOL",
};

const ROUND_TAB_LABELS: Record<string, string> = {
  preliminary: "Fase Previa",
  quarterfinal: "Cuartos",
  semifinal: "Semis",
  final: "Final",
  lolonmebol: "Final LOLONMEBOL",
};

const ROUND_ORDER = [
  "preliminary",
  "quarterfinal",
  "semifinal",
  "final",
  "lolonmebol",
] as const;

function CupTieCard({
  tie,
  isSupercup,
  isFinal,
}: {
  tie: ResolvedCupTie;
  isSupercup: boolean;
  isFinal: boolean;
}) {
  return (
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
          tie.isAWin
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
          <span className="truncate">{tie.playerAName}</span>
        </div>
        <span className="font-display shrink-0 text-lg font-extrabold text-ink">
          {tie.hasScores ? tie.scoreA : "—"}
        </span>
      </div>

      <div className="h-px bg-rule" />

      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-sm",
          tie.isBWin
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
          <span className="truncate">{tie.playerBName}</span>
        </div>
        <span className="font-display shrink-0 text-lg font-extrabold text-ink">
          {tie.hasScores ? tie.scoreB : "—"}
        </span>
      </div>

      {tie.notes && (
        <div className="border-t border-rule bg-surface-subtle/60 px-3 py-1.5 text-xs text-ink-muted">
          {tie.notes}
        </div>
      )}
    </div>
  );
}

export function CupBracketView({ ties, editionName }: CupBracketViewProps) {
  const activeRounds = ROUND_ORDER.map((round) => ({
    round,
    ties: ties
      .filter((t) => t.round === round)
      .sort((a, b) => a.slotOrder - b.slotOrder),
  })).filter((r) => r.ties.length > 0);

  const [selectedRound, setSelectedRound] = useState<string>(
    () => activeRounds[0]?.round ?? "preliminary"
  );

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

  const currentMobileRound =
    activeRounds.find((r) => r.round === selectedRound) ?? activeRounds[0];
  const isMobileSupercup = currentMobileRound.round === "lolonmebol";
  const isMobileFinal = currentMobileRound.round === "final";

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
      </div>

      {/* Mobile Round Selector + Full-Width Stacked Ties (< 640px) */}
      <div className="space-y-2.5 sm:hidden">
        <div
          role="tablist"
          aria-label="Rondas de Copa"
          className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1"
        >
          {activeRounds.map(({ round }) => {
            const isSelected = currentMobileRound.round === round;
            const isSupercup = round === "lolonmebol";
            const isFinal = round === "final";
            return (
              <button
                key={round}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedRound(round)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-md border px-3 text-sm font-bold transition-colors",
                  isSelected
                    ? isSupercup
                      ? "border-pitch-900 bg-pitch-800 text-gold-400"
                      : isFinal
                        ? "border-leather-600 bg-leather-600 text-white"
                        : "border-pitch-800 bg-pitch-800 text-white"
                    : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
                )}
              >
                {ROUND_TAB_LABELS[round] ?? ROUND_LABELS[round]}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          className="rounded-lg border border-rule bg-surface p-3.5"
        >
          <div
            className={cn(
              "mb-3 flex items-center justify-between border-b pb-2",
              isMobileSupercup
                ? "border-gold-500"
                : isMobileFinal
                  ? "border-leather-600"
                  : "border-rule"
            )}
          >
            <h4
              className={cn(
                "font-display text-base font-bold uppercase tracking-wider",
                isMobileSupercup
                  ? "text-gold-700"
                  : isMobileFinal
                    ? "text-leather-700"
                    : "text-pitch-800"
              )}
            >
              {ROUND_LABELS[currentMobileRound.round]}
            </h4>
            <span className="text-xs font-medium text-ink-muted">
              {currentMobileRound.ties.length}{" "}
              {currentMobileRound.ties.length === 1 ? "llave" : "llaves"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {currentMobileRound.ties.map((tie) => (
              <CupTieCard
                key={tie.id}
                tie={tie}
                isSupercup={isMobileSupercup}
                isFinal={isMobileFinal}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Horizontal Progression Bracket (sm+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-rule bg-surface p-4 sm:block">
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
                    {roundTies.length}{" "}
                    {roundTies.length === 1 ? "llave" : "llaves"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-around gap-3">
                  {roundTies.map((tie) => (
                    <div key={tie.id} className="relative flex items-center">
                      <CupTieCard
                        tie={tie}
                        isSupercup={isSupercup}
                        isFinal={isFinal}
                      />

                      {/* Horizontal connector stub to next round */}
                      {hasNextRound && (
                        <div
                          aria-hidden="true"
                          className="h-px w-3 shrink-0 bg-rule-strong"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
