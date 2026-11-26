"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Trophy,
  X,
} from "lucide-react";
import type { CalendarEventType, Season } from "@/lib/types/domain";
import type {
  CalendarEventItem,
  CalendarMonthGroup,
} from "@/lib/types/view-models";
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

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function shiftMonthKey(yyyyMm: string, deltaMonths: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return new Date().toISOString().slice(0, 7);
  const date = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1 + deltaMonths, 1)
  );
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mo}`;
}

function buildMonthGrid(
  yyyyMm: string
): Array<{ dateStr: string; dayNumber: number } | null> {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return [];
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const firstDay = new Date(Date.UTC(year, monthIdx, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const leadingBlanks = (firstDay.getUTCDay() + 6) % 7;

  const cells: Array<{ dateStr: string; dayNumber: number } | null> = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    cells.push({
      dateStr: `${yyyyMm}-${dayStr}`,
      dayNumber: d,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

interface CalendarInteractiveViewProps {
  seasons: Season[];
  selectedSeasonId: string;
  events: CalendarEventItem[];
  groupedByMonth: CalendarMonthGroup[];
  initialMonth: string;
}

export function CalendarInteractiveView({
  seasons,
  selectedSeasonId,
  events,
  groupedByMonth: initialGroupedByMonth,
  initialMonth,
}: CalendarInteractiveViewProps) {
  const [typeFilter, setTypeFilter] = useState<CalendarEventType | "ALL">(
    "ALL"
  );
  const [viewMode, setViewMode] = useState<"grid" | "agenda">("grid");
  const [currentMonth, setCurrentMonth] = useState<string>(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) {
      setViewMode("agenda");
    }
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === "ALL") return events;
    return events.filter((ev) => ev.eventType === typeFilter);
  }, [events, typeFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of filtered) {
      const list = map.get(ev.eventDate) ?? [];
      list.push(ev);
      map.set(ev.eventDate, list);
    }
    return map;
  }, [filtered]);

  const groupedByMonth = useMemo(() => {
    if (typeFilter === "ALL") return initialGroupedByMonth;
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of filtered) {
      const monthKey = ev.eventDate.slice(0, 7);
      const list = map.get(monthKey) ?? [];
      list.push(ev);
      map.set(monthKey, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, monthEvents]) => ({ monthKey, events: monthEvents }));
  }, [filtered, initialGroupedByMonth, typeFilter]);

  const monthCells = useMemo(
    () => buildMonthGrid(currentMonth),
    [currentMonth]
  );

  const selectedDayEvents = useMemo(() => {
    if (selectedEventId) {
      const ev = filtered.find((e) => e.id === selectedEventId);
      return ev ? [ev] : [];
    }
    if (selectedDate) {
      return eventsByDate.get(selectedDate) ?? [];
    }
    return [];
  }, [selectedEventId, selectedDate, filtered, eventsByDate]);

  useEffect(() => {
    if (selectedDayEvents.length === 0) return;
    if (detailPanelRef.current) {
      detailPanelRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedDate, selectedEventId, selectedDayEvents.length]);

  useEffect(() => {
    if (selectedDayEvents.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedDate(null);
        setSelectedEventId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDayEvents.length]);

  const handleGoToday = () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayMonth = todayIso.slice(0, 7);
    if (filtered.some((e) => e.eventDate.startsWith(todayMonth))) {
      setCurrentMonth(todayMonth);
      setSelectedDate(todayIso);
    } else if (filtered.length > 0) {
      setCurrentMonth(filtered[0].eventDate.slice(0, 7));
      setSelectedDate(filtered[0].eventDate);
    } else {
      setCurrentMonth(todayMonth);
    }
    setSelectedEventId(null);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display flex items-center gap-2 text-3xl font-extrabold tracking-wide text-ink">
            <CalendarDays className="h-6 w-6 text-pitch-700" />
            Calendario Oficial
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Grilla mensual interactiva y agenda de Liga, Copa, Final LOLONMEBOL, F11 y descansos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-rule bg-surface p-0.5"
            role="group"
            aria-label="Modo de vista"
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3 text-xs font-bold transition-colors",
                viewMode === "grid"
                  ? "bg-pitch-800 text-white"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              aria-pressed={viewMode === "agenda"}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-sm px-3 text-xs font-bold transition-colors",
                viewMode === "agenda"
                  ? "bg-pitch-800 text-white"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <List className="h-3.5 w-3.5" />
              Agenda
            </button>
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Temporada"
          >
            {seasons.map((s, index) => {
              const isSelected = selectedSeasonId === s.id;
              const href =
                index === 0 ? "/calendario" : `/calendario?season=${s.year}`;
              return (
                <Link
                  key={s.id}
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
                  {s.year}
                </Link>
              );
            })}
            <Link
              href="/calendario?season=all"
              scroll={false}
              aria-current={selectedSeasonId === "ALL" ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-md border px-3.5 text-sm font-semibold transition-colors",
                selectedSeasonId === "ALL"
                  ? "border-leather-600 bg-leather-600 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              Todas
            </Link>
          </div>
        </div>
      </header>

      {/* Event Type Filter */}
      <div
        className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        role="group"
        aria-label="Tipo de evento"
      >
        <button
          type="button"
          onClick={() => setTypeFilter("ALL")}
          className={cn(
            "min-h-10 shrink-0 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition-colors",
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
                "inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-semibold transition-colors",
                typeFilter === key
                  ? "border-pitch-800 bg-pitch-800 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  typeFilter === key ? "bg-gold-400" : meta.dot
                )}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* VIEW MODE 1: INTERACTIVE MONTHLY GRID */}
      {viewMode === "grid" ? (
        <section className="overflow-hidden rounded-lg border border-rule bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-surface-subtle px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => shiftMonthKey(m, -1))}
                aria-label="Mes anterior"
                className="inline-flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:border-pitch-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="font-display min-w-[140px] text-center text-xl font-extrabold tracking-wide text-pitch-800">
                {formatMonthKeyEs(currentMonth)}
              </h2>
              <button
                type="button"
                onClick={() => setCurrentMonth((m) => shiftMonthKey(m, 1))}
                aria-label="Mes siguiente"
                className="inline-flex h-10 w-10 min-h-10 min-w-10 items-center justify-center rounded-md border border-rule bg-surface text-ink hover:border-pitch-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGoToday}
                className="min-h-10 rounded-md border border-pitch-800 bg-pitch-50 px-3 text-xs font-bold text-pitch-800 transition-colors hover:bg-pitch-100"
              >
                Hoy / Último mes activo
              </button>
              <select
                aria-label="Saltar a mes con actividad"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="h-10 rounded-md border border-rule bg-surface px-2.5 text-base font-semibold leading-normal text-ink sm:text-sm"
              >
                {!groupedByMonth.some((g) => g.monthKey === currentMonth) && (
                  <option value={currentMonth}>
                    {formatMonthKeyEs(currentMonth)} (0 eventos)
                  </option>
                )}
                {groupedByMonth.map(({ monthKey, events: evs }) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthKeyEs(monthKey)} ({evs.length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-rule bg-paper text-center text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-rule">
            {monthCells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-12 bg-paper p-1 sm:min-h-24 sm:p-1.5"
                  />
                );
              }
              const dayEvents = eventsByDate.get(cell.dateStr) ?? [];
              const hasEvents = dayEvents.length > 0;
              const isSelected = selectedDate === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    if (hasEvents) {
                      setSelectedEventId(null);
                      setSelectedDate(cell.dateStr);
                    }
                  }}
                  role={hasEvents ? "button" : undefined}
                  tabIndex={hasEvents ? 0 : undefined}
                  aria-label={
                    hasEvents
                      ? `${cell.dayNumber} — ${dayEvents.length} ${dayEvents.length === 1 ? "evento" : "eventos"}`
                      : undefined
                  }
                  aria-pressed={hasEvents ? isSelected : undefined}
                  onKeyDown={(e) => {
                    if (hasEvents && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setSelectedEventId(null);
                      setSelectedDate(cell.dateStr);
                    }
                  }}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-between p-1.5 transition-colors sm:min-h-24 sm:items-stretch sm:justify-start sm:p-2",
                    hasEvents
                      ? "cursor-pointer bg-pitch-50 hover:bg-pitch-100/70"
                      : "bg-surface",
                    isSelected &&
                      "bg-gold-50 ring-2 ring-inset ring-leather-600"
                  )}
                >
                  <div className="flex w-full items-center justify-center sm:justify-between">
                    <span
                      className={cn(
                        "font-display inline-flex h-6 w-6 items-center justify-center rounded-sm text-xs font-extrabold",
                        hasEvents
                          ? "bg-pitch-800 text-white"
                          : "text-ink-muted"
                      )}
                    >
                      {cell.dayNumber}
                    </span>
                    {hasEvents && (
                      <div className="hidden items-center gap-1 sm:flex">
                        {dayEvents.map((ev) => (
                          <span
                            key={ev.id}
                            className={cn(
                              "h-2 w-2 rounded-full",
                              EVENT_TYPE_META[ev.eventType].dot
                            )}
                            title={EVENT_TYPE_META[ev.eventType].label}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Compact colored status dots on mobile */}
                  {hasEvents && (
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1 sm:hidden">
                      {dayEvents.map((ev) => (
                        <span
                          key={ev.id}
                          className={cn(
                            "h-2 w-2 rounded-full",
                            EVENT_TYPE_META[ev.eventType].dot
                          )}
                          title={EVENT_TYPE_META[ev.eventType].label}
                        />
                      ))}
                    </div>
                  )}

                  {/* Full event title pills on desktop */}
                  {hasEvents && (
                    <div className="mt-1.5 hidden space-y-1 sm:block">
                      {dayEvents.map((ev) => {
                        const meta = EVENT_TYPE_META[ev.eventType];
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(cell.dateStr);
                              setSelectedEventId(ev.id);
                            }}
                            className={cn(
                              "block w-full truncate rounded-sm border px-1.5 py-0.5 text-left text-[11px] font-bold transition-colors",
                              meta.badge
                            )}
                            title={ev.title}
                          >
                            {ev.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* VIEW MODE 2: Monthly Agenda Ledger */}
      {groupedByMonth.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">
            No hay eventos programados con este filtro.
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Cambiá la categoría o consultá todas las temporadas.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {typeFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className="inline-flex min-h-11 items-center rounded-md border border-pitch-800 bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
              >
                Mostrar todos los tipos
              </button>
            )}
            {selectedSeasonId !== "ALL" && (
              <Link
                href="/calendario?season=all"
                scroll={false}
                className="inline-flex min-h-11 items-center rounded-md border border-rule bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-rule-strong"
              >
                Ver todas las temporadas
              </Link>
            )}
          </div>
        </div>
      ) : viewMode === "agenda" ? (
        <div className="space-y-4">
          {groupedByMonth.map(({ monthKey, events: monthEvents }) => (
            <section
              key={monthKey}
              className="overflow-hidden rounded-lg border border-rule bg-surface"
            >
              <h2 className="font-display border-b border-rule bg-surface-subtle px-4 py-2.5 text-lg font-bold tracking-wide text-pitch-800">
                {formatMonthKeyEs(monthKey)}
              </h2>
              <ul className="divide-y divide-rule">
                {monthEvents.map((ev) => {
                  const meta = EVENT_TYPE_META[ev.eventType];
                  const isItemSelected = selectedEventId === ev.id;
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(ev.eventDate);
                          setSelectedEventId(ev.id);
                        }}
                        aria-pressed={isItemSelected}
                        className={cn(
                          "flex min-h-11 w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-pitch-50/40 sm:flex-row sm:items-center sm:justify-between",
                          isItemSelected && "bg-gold-50/50"
                        )}
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {/* Selected Day / Event Detail Panel (below calendar grid / agenda) */}
      {selectedDayEvents.length > 0 && (
        <section
          ref={detailPanelRef}
          aria-label="Detalle del evento seleccionado"
          className="pitch-chalk-surface rounded-lg border border-pitch-900 p-4 text-paper"
        >
          <div className="flex items-start justify-between gap-2 border-b border-white/15 pb-2.5">
            <div>
              <h2 className="font-display text-xl font-extrabold tracking-wide text-white">
                {selectedDayEvents.length === 1
                  ? selectedDayEvents[0].title
                  : `${selectedDayEvents.length} eventos en este día`}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-gold-400">
                {formatDateEs(selectedDayEvents[0].eventDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setSelectedEventId(null);
              }}
              aria-label="Cerrar detalle"
              className="inline-flex h-10 w-10 min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md border border-white/20 bg-pitch-900/60 text-white hover:bg-pitch-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {selectedDayEvents.map((ev) => {
              const meta = EVENT_TYPE_META[ev.eventType];
              const linkedMatch = ev.linkedMatch;
              return (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between rounded-md bg-pitch-950/55 p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-sm border px-2 py-0.5 text-xs font-bold",
                          meta.badge
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs font-semibold text-pitch-100">
                        {formatDateEs(ev.eventDate)}
                      </span>
                    </div>
                    <h3 className="font-display mt-2 text-lg font-bold tracking-wide text-white">
                      {ev.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-pitch-100">
                      {ev.description ||
                        "Sin notas adicionales para esta jornada."}
                    </p>

                    {linkedMatch && (
                      <div className="mt-2.5 flex items-center justify-between rounded-sm bg-pitch-900/70 px-2.5 py-1.5 text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-gold-400">
                          <Trophy className="h-3.5 w-3.5" />
                          Modalidad {linkedMatch.modality}
                          {linkedMatch.matchNumber !== null
                            ? ` · Fecha #${linkedMatch.matchNumber}`
                            : ""}
                        </span>
                        <span className="font-display text-sm font-extrabold text-white">
                          {linkedMatch.teamAScore ?? "—"} –{" "}
                          {linkedMatch.teamBScore ?? "—"}
                        </span>
                      </div>
                    )}
                  </div>

                  {ev.matchId && (
                    <Link
                      href={`/partidos?date=${encodeURIComponent(ev.eventDate)}`}
                      className="mt-3 inline-flex min-h-10 items-center justify-between rounded-md bg-gold-400 px-3 text-xs font-extrabold text-ink transition-colors hover:bg-gold-500"
                    >
                      <span>Ver planilla del partido asociado</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
