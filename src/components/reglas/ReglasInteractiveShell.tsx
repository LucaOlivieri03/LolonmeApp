"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReglasSectionKey =
  | "estructura"
  | "puntajes"
  | "copa"
  | "lolonmebol"
  | "especiales"
  | "rendimientos";

export interface ReglasSectionSlot {
  id: ReglasSectionKey;
  label: string;
  shortLabel: string;
  title: string;
  icon: ReactNode;
  content: ReactNode;
}

interface ReglasInteractiveShellProps {
  sections: ReglasSectionSlot[];
}

export function ReglasInteractiveShell({
  sections,
}: ReglasInteractiveShellProps) {
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | ReglasSectionKey
  >("all");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(sections.map((section) => [section.id, true]))
  );

  const toggleSection = (id: ReglasSectionKey) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setAllOpen = (open: boolean) => {
    setOpenSections(
      Object.fromEntries(sections.map((section) => [section.id, open]))
    );
  };

  const allExpanded = sections.every((section) => openSections[section.id]);

  return (
    <>
      {/* Quick Index / Section Filters */}
      <nav
        aria-label="Índice rápido del reglamento"
        className="flex flex-col gap-2.5 rounded-lg border border-rule bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFilter("all")}
            className={cn(
              "min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              selectedFilter === "all"
                ? "bg-pitch-800 text-white"
                : "border border-rule bg-paper text-ink-muted hover:border-rule-strong hover:text-ink"
            )}
          >
            <span className="sm:hidden">Todo</span>
            <span className="hidden sm:inline">Todo el reglamento</span>
          </button>

          {sections.map((item) => {
            const active = selectedFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedFilter(item.id);
                  setOpenSections((prev) => ({ ...prev, [item.id]: true }));
                }}
                className={cn(
                  "min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-pitch-800 text-white"
                    : "border border-rule bg-paper text-ink-muted hover:border-rule-strong hover:text-ink"
                )}
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {selectedFilter === "all" && (
          <button
            type="button"
            onClick={() => setAllOpen(!allExpanded)}
            className="self-end text-xs font-semibold text-pitch-700 underline decoration-pitch-700/40 hover:text-pitch-900 sm:self-auto"
          >
            {allExpanded ? "Contraer secciones" : "Expandir todo"}
          </button>
        )}
      </nav>

      {/* Server-rendered section contents inside lightweight accordion frames */}
      {sections.map((section) => {
        if (selectedFilter !== "all" && selectedFilter !== section.id) {
          return null;
        }
        const isOpen = Boolean(openSections[section.id]);
        return (
          <section
            key={section.id}
            id={section.id}
            className="overflow-hidden rounded-lg border border-rule bg-surface"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 border-b border-rule bg-surface-subtle/60 px-4 py-3.5 text-left transition-colors hover:bg-surface-subtle sm:px-5"
            >
              <div className="flex items-center gap-2.5">
                {section.icon}
                <h2 className="font-display text-xl font-extrabold tracking-wide text-ink sm:text-2xl">
                  {section.title}
                </h2>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            {isOpen && section.content}
          </section>
        );
      })}
    </>
  );
}
