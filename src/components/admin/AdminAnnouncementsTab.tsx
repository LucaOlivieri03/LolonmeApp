"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Megaphone, Trash2 } from "lucide-react";
import { resolveDefaultSeasonId } from "@/lib/engine";
import type {
  Announcement,
  CalendarEvent,
  CalendarEventType,
  Match,
  MatchType,
  Season,
} from "@/lib/types/domain";
import { cn, formatDateEs } from "@/lib/utils";
import {
  createAnnouncementAction,
  createCalendarEventAction,
  deleteAnnouncementAction,
  deleteCalendarEventAction,
} from "@/server/actions/community";

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  league: "Liga",
  league_tiebreaker: "Desempate Liga",
  cup: "Copa",
  lolonmebol: "Final LOLONMEBOL",
  special_f11: "Fecha Especial F11",
};

interface AdminAnnouncementsTabProps {
  seasons: Season[];
  matches: Match[];
  announcements: Announcement[];
  calendarEvents: CalendarEvent[];
  defaultSeasonId: string;
}

export function AdminAnnouncementsTab({
  seasons,
  matches,
  announcements,
  calendarEvents,
  defaultSeasonId,
}: AdminAnnouncementsTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rawSeasonId, setRawSeasonId] = useState(defaultSeasonId);
  const seasonId = resolveDefaultSeasonId(seasons, rawSeasonId);

  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPinned, setAnnPinned] = useState(false);

  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evMatchId, setEvMatchId] = useState("");
  const [evDate, setEvDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [evType, setEvType] = useState<CalendarEventType>("league");

  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await createAnnouncementAction({
        title: annTitle.trim(),
        body: annBody.trim(),
        isPinned: annPinned,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setAnnTitle("");
      setAnnBody("");
      setAnnPinned(false);
      setFeedback({ type: "success", text: res.message ?? "Anuncio publicado." });
      router.refresh();
    });
  };

  const handleDeleteAnnouncement = (announcementId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteAnnouncementAction({ announcementId });
      setPendingDeleteKey(null);
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({ type: "success", text: res.message ?? "Anuncio eliminado." });
      router.refresh();
    });
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await createCalendarEventAction({
        seasonId,
        title: evTitle.trim(),
        description: evDesc.trim() || null,
        matchId: evMatchId || null,
        eventDate: evDate,
        eventType: evType,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setEvTitle("");
      setEvDesc("");
      setEvMatchId("");
      setFeedback({
        type: "success",
        text: res.message ?? "Evento agregado al calendario.",
      });
      router.refresh();
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteCalendarEventAction({ eventId });
      setPendingDeleteKey(null);
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({ type: "success", text: res.message ?? "Evento eliminado." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <p
          className={cn(
            "rounded-md border px-3.5 py-2.5 text-sm font-semibold",
            feedback.type === "success"
              ? "border-pitch-200 bg-pitch-50 text-pitch-800"
              : "border-crimson-600/35 bg-crimson-50 text-crimson-700"
          )}
        >
          {feedback.text}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-rule bg-surface p-4">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
            <Megaphone className="h-5 w-5 text-pitch-700" />
            Nuevo Anuncio
          </h2>
          <form onSubmit={handleAddAnnouncement} className="space-y-2.5">
            <input
              type="text"
              placeholder="Título del anuncio"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
              required
            />
            <textarea
              placeholder="Mensaje para los jugadores..."
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-base text-ink sm:text-sm"
              required
            />
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
                className="h-4 w-4 accent-pitch-800"
              />
              Fijar arriba en Inicio
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-11 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
            >
              {isPending ? "Publicando..." : "Publicar Anuncio"}
            </button>
          </form>

          <ul className="divide-y divide-rule border-t border-rule pt-2 text-sm">
            {announcements.map((a) => {
              const delKey = `ann:${a.id}`;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <span className="font-semibold text-ink">{a.title}</span>
                  {pendingDeleteKey === delKey ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="min-h-9 rounded-md bg-crimson-600 px-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Borrar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setPendingDeleteKey(null)}
                        className="min-h-9 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink-muted"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPendingDeleteKey(delKey)}
                      aria-label={`Eliminar anuncio ${a.title}`}
                      className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-crimson-50 hover:text-crimson-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3 rounded-lg border border-rule bg-surface p-4">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
            <CalendarPlus className="h-5 w-5 text-navy-700" />
            Nuevo Evento de Calendario
          </h2>
          <form onSubmit={handleAddEvent} className="space-y-2.5">
            <select
              aria-label="Temporada del evento"
              value={seasonId}
              onChange={(e) => setRawSeasonId(e.target.value)}
              className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Ej. Fecha 40 - Liga / Descanso"
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
                required
              />
              <select
                value={evType}
                onChange={(e) =>
                  setEvType(e.target.value as CalendarEventType)
                }
                className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
              >
                <option value="league">Liga</option>
                <option value="cup">Copa</option>
                <option value="lolonmebol">Final LOLONMEBOL</option>
                <option value="special_f11">F11 Especial</option>
                <option value="rest">Descanso</option>
                <option value="postponed">Aplazado</option>
              </select>
            </div>
            <textarea
              placeholder="Descripción / Notas opcionales (ej. Cancha 2, 21:00 hs)"
              value={evDesc}
              onChange={(e) => setEvDesc(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-base text-ink sm:text-sm"
            />
            <select
              aria-label="Vincular partido opcional"
              value={evMatchId}
              onChange={(e) => setEvMatchId(e.target.value)}
              className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
            >
              <option value="">Sin partido vinculado (opcional)</option>
              {matches
                .filter((m) => m.seasonId === seasonId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {MATCH_TYPE_LABELS[m.matchType]}
                    {m.matchNumber !== null ? ` #${m.matchNumber}` : ""} ·{" "}
                    {formatDateEs(m.matchDate)} ({m.teamAScore ?? "—"}–
                    {m.teamBScore ?? "—"})
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-11 rounded-md bg-navy-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900 disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "Agregar al Calendario"}
            </button>
          </form>

          <ul className="divide-y divide-rule border-t border-rule pt-2 text-sm">
            {calendarEvents.slice(0, 6).map((ev) => {
              const delKey = `ev:${ev.id}`;
              return (
                <li
                  key={ev.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <span className="min-w-0">
                    <strong className="font-display text-base text-ink">
                      {formatDateEs(ev.eventDate, { omitYear: true })}
                    </strong>{" "}
                    <span className="text-ink-muted">·</span> {ev.title}
                  </span>
                  {pendingDeleteKey === delKey ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="min-h-9 rounded-md bg-crimson-600 px-2.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Borrar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setPendingDeleteKey(null)}
                        className="min-h-9 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink-muted"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setPendingDeleteKey(delKey)}
                      aria-label={`Eliminar evento ${ev.title}`}
                      className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-crimson-50 hover:text-crimson-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
