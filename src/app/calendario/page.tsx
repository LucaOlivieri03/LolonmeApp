"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import type { CalendarEventType } from "@/lib/types/domain";
import { cn, formatDateEs, formatMonthKeyEs } from "@/lib/utils";

const EVENT_TYPE_META: Record<
  CalendarEventType,
  { label: string; dot: string; badge: string }
> = {
  league: {
    label: "Liga",
    dot: "bg-pitch-700",
    badge: "border-pitch-200 bg-pitch-50 text-pitch-800",
  },
  cup: {
    label: "Copa",
    dot: "bg-gold-500",
    badge: "border-gold-500/40 bg-gold-50 text-gold-700",
  },
  lolonmebol: {
    label: "Final LOLONMEBOL",
    dot: "bg-pitch-900",
    badge: "border-pitch-900 bg-pitch-800 text-gold-400",
  },
  special_f11: {
    label: "F11 Especial",
    dot: "bg-navy-700",
    badge: "border-navy-100 bg-navy-50 text-navy-800",
  },
  rest: {
    label: "Descanso",
    dot: "bg-rule-strong",
    badge: "border-rule bg-surface-subtle text-ink-muted",
  },
  postponed: {
    label: "Aplazado",
    dot: "bg-crimson-600",
    badge: "border-crimson-600/30 bg-crimson-50 text-crimson-700",
  },
};

export default function CalendarioPage() {
  const { dataset } = useTournament();
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );

  const [seasonId, setSeasonId] = useState<string>(
    sortedSeasons[0]?.id ?? "ALL"
  );
  const [typeFilter, setTypeFilter] = useState<CalendarEventType | "ALL">("ALL");

  const filtered = useMemo(() => {
    return dataset.calendarEvents.filter((ev) => {
      if (seasonId !== "ALL" && ev.seasonId !== seasonId) return false;
      if (typeFilter !== "ALL" && ev.eventType !== typeFilter) return false;
      return true;
    });
  }, [dataset.calendarEvents, seasonId, typeFilter]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const ev of filtered) {
      const monthKey = ev.eventDate.slice(0, 7);
      const list = map.get(monthKey) ?? [];
      list.push(ev);
      map.set(monthKey, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
            <CalendarDays className="h-6 w-6 text-pitch-700" />
            Calendario Oficial
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Agenda de Liga, Copa, Final LOLONMEBOL, F11 Especiales y descansos
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Temporada">
          {sortedSeasons.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeasonId(s.id)}
              className={cn(
                "font-display min-h-10 rounded-md border px-3.5 text-base font-bold tracking-wide transition-colors",
                seasonId === s.id
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              {s.year}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeasonId("ALL")}
            className={cn(
              "min-h-10 rounded-md border px-3.5 text-sm font-semibold transition-colors",
              seasonId === "ALL"
                ? "border-leather-600 bg-leather-600 text-white"
                : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
            )}
          >
            Todas
          </button>
        </div>
      </header>

      {/* Event Type Filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de evento">
        <button
          type="button"
          onClick={() => setTypeFilter("ALL")}
          className={cn(
            "min-h-10 rounded-md border px-3 text-sm font-semibold transition-colors",
            typeFilter === "ALL"
              ? "border-pitch-800 bg-pitch-800 text-white"
              : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
          )}
        >
          Todos ({filtered.length})
        </button>
        {(Object.keys(EVENT_TYPE_META) as CalendarEventType[]).map((key) => {
          const meta = EVENT_TYPE_META[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors",
                typeFilter === key
                  ? "border-pitch-800 bg-pitch-800 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  typeFilter === key ? "bg-gold-400" : meta.dot
                )}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Monthly Agenda Ledger */}
      {groupedByMonth.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">
            No hay eventos programados con este filtro.
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Cambiá la categoría o consultá todas las temporadas.
          </p>
          <button
            type="button"
            onClick={() => {
              setSeasonId("ALL");
              setTypeFilter("ALL");
            }}
            className="mt-4 inline-flex min-h-11 items-center rounded-md border border-pitch-800 bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
          >
            Mostrar agenda completa
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByMonth.map(([monthKey, events]) => (
            <section
              key={monthKey}
              className="overflow-hidden rounded-lg border border-rule bg-surface"
            >
              <h2 className="font-display border-b border-rule bg-surface-subtle px-4 py-2.5 text-lg font-bold tracking-wide text-pitch-800">
                {formatMonthKeyEs(monthKey)}
              </h2>
              <ul className="divide-y divide-rule">
                {events.map((ev) => {
                  const meta = EVENT_TYPE_META[ev.eventType];
                  return (
                    <li
                      key={ev.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-display min-w-[4.5rem] shrink-0 rounded-sm bg-paper px-2 py-1 text-center text-sm font-bold text-ink">
                          {formatDateEs(ev.eventDate, { omitYear: true })}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink">
                            {ev.title}
                          </p>
                          {ev.description && (
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "w-fit shrink-0 rounded-sm border px-2.5 py-1 text-xs font-bold",
                          meta.badge
                        )}
                      >
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
