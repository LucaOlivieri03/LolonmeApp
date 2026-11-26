"use client";

import { useId, useRef, useState } from "react";
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
  lolonmebol: "LOLONMEBOL",
};

const ROUND_TAB_LABELS: Record<string, string> = {
  preliminary: "Fase Previa",
  quarterfinal: "Cuartos",
  semifinal: "Semis",
  final: "Final",
  lolonmebol: "LOLONMEBOL",
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
  const isTitleMatch = isSupercup || isFinal;
  const hasChampion = isTitleMatch && (tie.isAWin || tie.isBWin);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-md border bg-paper",
        isSupercup
          ? "border-comp-lolonmebol bg-comp-lolonmebol-bg/50"
          : hasChampion
            ? "border-comp-cup bg-comp-cup-bg"
            : isFinal
              ? "border-comp-cup/70"
              : "border-rule"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-sm",
          tie.isAWin
            ? isSupercup
              ? "bg-comp-lolonmebol-bg font-bold text-comp-lolonmebol-fg"
              : "bg-comp-cup-bg font-bold text-comp-cup-fg"
            : "bg-surface text-ink"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {tie.seedA && (
            <span
              className={cn(
                "font-display inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-white",
                isSupercup ? "bg-comp-lolonmebol" : "bg-comp-cup"
              )}
            >
              {tie.seedA}
            </span>
          )}
          <span className="truncate">{tie.playerAName}</span>
          {isTitleMatch && tie.isAWin && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                isSupercup
                  ? "border-comp-lolonmebol/60 bg-comp-lolonmebol-bg text-comp-lolonmebol-fg"
                  : "border-comp-cup/60 bg-comp-cup-bg text-comp-cup-fg"
              )}
            >
              <Trophy className="h-3 w-3" aria-hidden="true" />
              Campeón
            </span>
          )}
        </div>
        <span className="font-display shrink-0 text-lg font-extrabold text-ink">
          {tie.hasScores ? tie.scoreA : "—"}
        </span>
      </div>

      <div
        className={cn(
          "h-px",
          isSupercup
            ? "bg-comp-lolonmebol/40"
            : hasChampion
              ? "bg-comp-cup/40"
              : "bg-rule"
        )}
      />

      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 text-sm",
          tie.isBWin
            ? isSupercup
              ? "bg-comp-lolonmebol-bg font-bold text-comp-lolonmebol-fg"
              : "bg-comp-cup-bg font-bold text-comp-cup-fg"
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
          {isTitleMatch && tie.isBWin && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                isSupercup
                  ? "border-comp-lolonmebol/60 bg-comp-lolonmebol-bg text-comp-lolonmebol-fg"
                  : "border-comp-cup/60 bg-comp-cup-bg text-comp-cup-fg"
              )}
            >
              <Trophy className="h-3 w-3" aria-hidden="true" />
              Campeón
            </span>
          )}
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

function BracketConnectorColumn({
  prevCount,
  nextCount,
  isIntoSupercup,
}: {
  prevCount: number;
  nextCount: number;
  isIntoSupercup: boolean;
}) {
  const isPaired = prevCount === nextCount * 2 && nextCount > 0;
  const strokeClass = isIntoSupercup ? "text-gold-500/80" : "text-rule-strong";

  return (
    <div
      aria-hidden="true"
      className="flex w-5 shrink-0 flex-col md:w-7"
    >
      {/* Spacer matching round header height so elbows align with tie centers */}
      <div className="mb-3 border-b border-transparent pb-2">
        <span className="font-display block text-base font-bold uppercase tracking-wider invisible">
          &nbsp;
        </span>
      </div>

      <div className="flex-1">
        <svg
          className={cn("h-full w-full", strokeClass)}
          viewBox="0 0 28 100"
          preserveAspectRatio="none"
          fill="none"
        >
          {isPaired ? (
            Array.from({ length: nextCount }).map((_, pairIdx) => {
              const yTop = ((pairIdx * 2 + 0.5) / prevCount) * 100;
              const yBottom = ((pairIdx * 2 + 1.5) / prevCount) * 100;
              const yMid = ((pairIdx + 0.5) / nextCount) * 100;
              return (
                <path
                  key={pairIdx}
                  d={`M 0 ${yTop} H 14 V ${yBottom} H 0 M 14 ${yMid} H 28`}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })
          ) : (
            <path
              d="M 0 50 H 28"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray={prevCount === 1 && nextCount > 1 ? "3 3" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const mobilePanelId = `${baseId}-round-panel`;

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

  const handleRoundTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const count = activeRounds.length;
    if (count <= 1) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % count;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + count) % count;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = count - 1;
    }
    if (nextIdx === null) return;
    e.preventDefault();
    setSelectedRound(activeRounds[nextIdx].round);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="pitch-chalk-surface flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pitch-900 px-4 py-3 text-paper">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 shrink-0 text-gold-400" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide text-white">
              {editionName}
            </h2>
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
          {activeRounds.map(({ round }, idx) => {
            const isSelected = currentMobileRound.round === round;
            const isSupercup = round === "lolonmebol";
            const isFinal = round === "final";
            return (
              <button
                key={round}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`${baseId}-tab-${round}`}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-controls={mobilePanelId}
                onClick={() => setSelectedRound(round)}
                onKeyDown={(e) => handleRoundTabKeyDown(e, idx)}
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
          id={mobilePanelId}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${currentMobileRound.round}`}
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
            <h3
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
            </h3>
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
        <div className="flex min-w-max items-stretch lg:min-w-0">
          {activeRounds.map(({ round, ties: roundTies }, roundIdx) => {
            const isSupercup = round === "lolonmebol";
            const isFinal = round === "final";
            const nextRound = activeRounds[roundIdx + 1];

            return (
              <div
                key={round}
                className="flex items-stretch lg:min-w-0 lg:flex-1"
              >
                <div className="flex w-52 shrink-0 flex-col lg:min-w-0 lg:flex-1">
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
                    <h3
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
                    </h3>
                    <span className="text-xs font-medium text-ink-muted">
                      {roundTies.length}{" "}
                      {roundTies.length === 1 ? "llave" : "llaves"}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col">
                    {roundTies.map((tie) => (
                      <div
                        key={tie.id}
                        className="flex flex-1 items-center py-1.5"
                      >
                        <CupTieCard
                          tie={tie}
                          isSupercup={isSupercup}
                          isFinal={isFinal}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {nextRound && (
                  <BracketConnectorColumn
                    prevCount={roundTies.length}
                    nextCount={nextRound.ties.length}
                    isIntoSupercup={nextRound.round === "lolonmebol"}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
