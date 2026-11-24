"use client";

import { useState } from "react";
import Link from "next/link";
import type { StandingsResult } from "@/lib/engine";
import type { Season } from "@/lib/types/domain";
import type { ResolvedCupTie } from "@/lib/types/view-models";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { CupBracketView } from "@/components/tournament/CupBracketView";
import { cn } from "@/lib/utils";

type HomeTab = "annual" | "historical" | "cup";

interface HomeCompetitionTabsProps {
  seasons: Season[];
  activeSeasonId: string | null;
  annualStandings: StandingsResult;
  historicalStandings: StandingsResult;
  cupEditionName: string;
  cupTies: ResolvedCupTie[];
}

export function HomeCompetitionTabs({
  seasons,
  activeSeasonId,
  annualStandings,
  historicalStandings,
  cupEditionName,
  cupTies,
}: HomeCompetitionTabsProps) {
  const [activeTab, setActiveTab] = useState<HomeTab>("annual");

  return (
    <section className="space-y-3" aria-label="Competencias del torneo">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
        <div
          role="tablist"
          aria-label="Vista de competencia"
          className="inline-flex rounded-md border border-rule bg-surface p-0.5"
        >
          {(
            [
              { id: "annual", label: "Tabla Anual" },
              { id: "historical", label: "Histórica" },
              { id: "cup", label: "Copa" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "min-h-10 rounded-sm px-3.5 text-sm font-semibold transition-colors",
                activeTab === id
                  ? "bg-pitch-800 text-white"
                  : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab !== "historical" && (
          <div className="flex items-center gap-1.5" role="group" aria-label="Temporada">
            {seasons.map((season, index) => {
              const isSelected = activeSeasonId === season.id;
              const href = index === 0 ? "/" : `/?season=${season.year}`;
              return (
                <Link
                  key={season.id}
                  href={href}
                  scroll={false}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "font-display inline-flex min-h-10 items-center rounded-md border px-3.5 text-base font-bold tracking-wide transition-colors",
                    isSelected
                      ? "border-leather-600 bg-leather-600 text-white"
                      : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
                  )}
                >
                  {season.year}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div role="tabpanel">
        {activeTab === "annual" && (
          <StandingsTable result={annualStandings} mode="annual" />
        )}
        {activeTab === "historical" && (
          <StandingsTable
            result={historicalStandings}
            mode="historical"
            initialLimit={15}
          />
        )}
        {activeTab === "cup" && (
          <CupBracketView ties={cupTies} editionName={cupEditionName} />
        )}
      </div>
    </section>
  );
}
