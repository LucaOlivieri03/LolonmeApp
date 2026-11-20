"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import type { CalendarEventType } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

const EVENT_TYPE_META: Record<
  CalendarEventType,
  { label: string; dot: string; badge: string }
> = {
  league: {
    label: "Liga",
    dot: "bg-pitch-600",
    badge: "bg-pitch-100 text-pitch-800",
  },
  cup: {
    label: "Copa",
    dot: "bg-gold-500",
    badge: "bg-gold-100 text-gold-700",
  },
  lolonmebol: {
    label: "Final LOLONMEBOL",
    dot: "bg-navy-800",
    badge: "bg-navy-800 text-gold-400",
  },
  special_f11: {
    label: "F11 Especial",
    dot: "bg-sky-400",
    badge: "bg-sky-400/20 text-navy-800",
  },
  rest: {
    label: "Descanso",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600",
  },
  postponed: {
    label: "Aplazado",
    dot: "bg-crimson-600",
    badge: "bg-red-100 text-crimson-600",
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
      const monthKey = ev.eventDate.slice(0, 7); // YYYY-MM
      const list = map.get(monthKey) ?? [];
      list.push(ev);
      map.set(monthKey, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-navy-900">
            <CalendarDays className="h-5 w-5 text-pitch-700" />
            Calendario de Eventos
          </h1>
          <p className="text-xs text-slate-500">
            Agenda oficial de Liga, Copa, Final LOLONMEBOL, F11 y descansos
          </p>
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

      {/* Color-coded legend & filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTypeFilter("ALL")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            typeFilter === "ALL"
              ? "bg-navy-900 text-white"
              : "border border-slate-200 bg-white text-slate-600"
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
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                typeFilter === key
                  ? "border-navy-800 bg-navy-800 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Monthly agenda */}
      <div className="space-y-4">
        {groupedByMonth.map(([monthKey, events]) => (
          <section
            key={monthKey}
            className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs"
          >
            <h2 className="mb-3 border-b border-slate-100 pb-2 text-xs font-extrabold uppercase tracking-wider text-pitch-800">
              {monthKey}
            </h2>
            <ul className="space-y-2">
              {events.map((ev) => {
                const meta = EVENT_TYPE_META[ev.eventType];
                return (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {ev.eventDate}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-navy-900">
                          {ev.title}
                        </p>
                        {ev.description && (
                          <p className="text-[11px] text-slate-500">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase",
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
    </div>
  );
}
