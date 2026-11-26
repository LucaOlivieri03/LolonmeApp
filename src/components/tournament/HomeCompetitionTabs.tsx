"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import type { StandingsResult } from "@/lib/engine";
import type { Season } from "@/lib/types/domain";
import type { ResolvedCupTie } from "@/lib/types/view-models";
import { StandingsTable } from "@/components/tournament/StandingsTable";
import { CupBracketView } from "@/components/tournament/CupBracketView";
import { cn } from "@/lib/utils";

type HomeTab = "annual" | "historical" | "cup";

const HOME_TABS: readonly { id: HomeTab; label: string }[] = [
  { id: "annual", label: "Tabla Anual" },
  { id: "historical", label: "Histórica" },
  { id: "cup", label: "Copa" },
];

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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const panelId = `${baseId}-panel`;

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const count = HOME_TABS.length;
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
    setActiveTab(HOME_TABS[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <section className="space-y-3" aria-label="Competencias del torneo">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
        <div
          role="tablist"
          aria-label="Vista de competencia"
          className="inline-flex rounded-md border border-rule bg-surface p-0.5"
        >
          {HOME_TABS.map(({ id, label }, idx) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`${baseId}-tab-${id}`}
                type="button"
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={panelId}
                onClick={() => setActiveTab(id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={cn(
                  "min-h-10 rounded-sm px-3.5 text-sm font-semibold transition-colors",
                  isActive
                    ? id === "annual"
                      ? "bg-comp-league text-white"
                      : id === "cup"
                        ? "bg-comp-cup text-white"
                        : "bg-pitch-800 text-white"
                    : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
                )}
              >
                {label}
              </button>
            );
          })}
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

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeTab}`}
      >
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
