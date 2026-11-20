"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  FileSpreadsheet,
  Lock,
  Megaphone,
  PlusCircle,
  Shield,
  Star,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { AdminPozoTab } from "@/components/admin/AdminPozoTab";
import { AdminCupTab } from "@/components/admin/AdminCupTab";
import { AdminExcelTab } from "@/components/admin/AdminExcelTab";
import type {
  CalendarEventType,
  Match,
  MatchModality,
  MatchType,
  PlayerRole,
  TitleType,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils";

type AdminTab =
  | "matches"
  | "announcements"
  | "cup"
  | "players"
  | "pozo"
  | "excel";

const ROLE_LABELS: Record<PlayerRole, string> = {
  admin: "Admin (Presidente)",
  authorized: "Jugador Autorizado",
  player: "Jugador",
  guest: "Invitado (sin cuenta)",
};

export default function AdminPage() {
  const {
    dataset,
    role,
    isLocalMode,
    setRole,
    addMatch,
    deleteMatch,
    addAnnouncement,
    deleteAnnouncement,
    addCalendarEvent,
    deleteCalendarEvent,
    addPlayer,
    updatePlayerRole,
    addPlayerTitle,
  } = useTournament();

  const [activeTab, setActiveTab] = useState<AdminTab>("matches");

  // Match form state
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );
  const [mSeasonId, setMSeasonId] = useState(sortedSeasons[0]?.id ?? "season-2026");
  const [mType, setMType] = useState<MatchType>("league");
  const [mModality, setMModality] = useState<MatchModality>("F5");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mNumber, setMNumber] = useState("");
  const [mScoreA, setMScoreA] = useState("8");
  const [mScoreB, setMScoreB] = useState("6");
  const [mCountsLeague, setMCountsLeague] = useState(true);
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [mvpId, setMvpId] = useState<string>("");
  const [matchSavedMsg, setMatchSavedMsg] = useState<string | null>(null);

  // Announcement form state
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPinned, setAnnPinned] = useState(false);

  // Calendar event form state
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState(new Date().toISOString().slice(0, 10));
  const [evType, setEvType] = useState<CalendarEventType>("league");

  // Player form state
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pRole, setPRole] = useState<Exclude<PlayerRole, "guest">>("player");
  const [titlePlayerId, setTitlePlayerId] = useState(dataset.players[0]?.id ?? "");
  const [titleType, setTitleType] = useState<TitleType>("league");

  const isAdmin = role === "admin";
  const isOperator = role === "admin" || role === "authorized";

  const availableTabs: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: "matches", label: "Partidos", icon: Trophy },
    { id: "announcements", label: "Anuncios y Cal.", icon: Megaphone },
    { id: "cup", label: "Copa", icon: Trophy, adminOnly: true },
    { id: "players", label: "Jugadores", icon: Users, adminOnly: true },
    { id: "pozo", label: "Pozo", icon: Wallet, adminOnly: true },
    { id: "excel", label: "Excel", icon: FileSpreadsheet, adminOnly: true },
  ];

  const visibleTabs = availableTabs.filter((t) => !t.adminOnly || isAdmin);
  const safeTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : "matches";

  const toggleTeamPlayer = (playerId: string, team: "A" | "B") => {
    if (team === "A") {
      setTeamBIds((prev) => prev.filter((id) => id !== playerId));
      setTeamAIds((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    } else {
      setTeamAIds((prev) => prev.filter((id) => id !== playerId));
      setTeamBIds((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    }
  };

  const handleCreateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamAIds.length === 0 || teamBIds.length === 0) return;

    const matchId = `m-manual-${Date.now()}`;
    const sA = Number(mScoreA);
    const sB = Number(mScoreB);

    const match: Match = {
      id: matchId,
      seasonId: mSeasonId,
      matchNumber: mNumber ? Number(mNumber) : null,
      matchDate: mDate,
      matchType: mType,
      modality: mModality,
      teamAScore: Number.isFinite(sA) ? sA : null,
      teamBScore: Number.isFinite(sB) ? sB : null,
      countsForLeague: mType === "lolonmebol" ? false : mCountsLeague,
      countsForStats: true,
      votingStatus: "closed",
      players: [
        ...teamAIds.map((pid) => ({
          id: `${matchId}-${pid}`,
          matchId,
          playerId: pid,
          team: "A" as const,
          isCupCaptain: false,
          goals: 0,
          assists: 0,
          adminRating: null,
          isMvp: pid === mvpId,
        })),
        ...teamBIds.map((pid) => ({
          id: `${matchId}-${pid}`,
          matchId,
          playerId: pid,
          team: "B" as const,
          isCupCaptain: false,
          goals: 0,
          assists: 0,
          adminRating: null,
          isMvp: pid === mvpId,
        })),
      ],
    };

    addMatch(match);
    setTeamAIds([]);
    setTeamBIds([]);
    setMvpId("");
    setMatchSavedMsg("Partido guardado. Tablas y estadísticas recalculadas automáticamente.");
  };

  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    addAnnouncement({
      title: annTitle.trim(),
      body: annBody.trim(),
      isPinned: annPinned,
    });
    setAnnTitle("");
    setAnnBody("");
    setAnnPinned(false);
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evTitle.trim()) return;
    addCalendarEvent({
      seasonId: mSeasonId,
      title: evTitle.trim(),
      eventDate: evDate,
      eventType: evType,
    });
    setEvTitle("");
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;
    addPlayer({ displayName: pName, email: pEmail, role: pRole });
    setPName("");
    setPEmail("");
  };

  return (
    <div className="space-y-4">
      {/* Header + Local Mode Role Switcher */}
      <div className="rounded-2xl border border-navy-800/15 bg-navy-900 p-4 text-white shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-gold-400" />
            <div>
              <h1 className="text-lg font-black tracking-tight">
                Panel de Administración y Operación
              </h1>
              <p className="text-[11px] text-navy-100">
                {isLocalMode
                  ? "Modo Local activo (sin Supabase conectado) · Simulador de roles para pruebas"
                  : `Sesión autenticada · Rol actual: ${ROLE_LABELS[role]}`}
              </p>
            </div>
          </div>

          {isLocalMode && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(["admin", "authorized", "player", "guest"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors",
                    role === r
                      ? "bg-gold-400 text-navy-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {ROLE_LABELS[r].split(" ")[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isOperator ? (
        <div className="rounded-2xl border border-crimson-600/25 bg-white p-6 text-center shadow-xs">
          <Lock className="mx-auto h-8 w-8 text-crimson-600" />
          <h2 className="mt-2 text-base font-black text-navy-900">
            Acceso Restringido ({ROLE_LABELS[role]})
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
            Solo los usuarios con rol <strong>Admin</strong> o{" "}
            <strong>Jugador Autorizado</strong> pueden operar el panel. Cambiá el rol arriba para probar permisos en modo local.
          </p>
        </div>
      ) : (
        <>
          {/* Admin Sub-Navigation */}
          <div className="flex flex-wrap gap-1.5">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
                  safeTab === id
                    ? "border-pitch-700 bg-pitch-700 text-white shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-pitch-50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* TAB 1: MATCHES */}
          {safeTab === "matches" && (
            <div className="space-y-4">
              <form
                onSubmit={handleCreateMatch}
                className="space-y-3 rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs"
              >
                <h2 className="flex items-center gap-1.5 text-sm font-black text-navy-900">
                  <PlusCircle className="h-4 w-4 text-pitch-700" />
                  Cargar Nuevo Partido
                </h2>

                <div className="grid gap-2.5 sm:grid-cols-5">
                  <select
                    value={mSeasonId}
                    onChange={(e) => setMSeasonId(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    {sortedSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={mType}
                    onChange={(e) => setMType(e.target.value as MatchType)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="league">Liga</option>
                    <option value="cup">Copa</option>
                    <option value="special_f11">Fecha Especial F11</option>
                    <option value="league_tiebreaker">Desempate Liga</option>
                    <option value="lolonmebol">Final LOLONMEBOL</option>
                  </select>
                  <select
                    value={mModality}
                    onChange={(e) => setMModality(e.target.value as MatchModality)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="F5">F5</option>
                    <option value="F6">F6</option>
                    <option value="F7">F7</option>
                    <option value="F11">F11</option>
                  </select>
                  <input
                    type="date"
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    required
                  />
                  <input
                    type="number"
                    placeholder="N° Fecha"
                    value={mNumber}
                    onChange={(e) => setMNumber(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs font-bold text-pitch-800">
                    Goles Eq. A:
                    <input
                      type="number"
                      value={mScoreA}
                      onChange={(e) => setMScoreA(e.target.value)}
                      className="ml-1.5 w-16 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                    />
                  </label>
                  <label className="text-xs font-bold text-navy-800">
                    Goles Eq. B:
                    <input
                      type="number"
                      value={mScoreB}
                      onChange={(e) => setMScoreB(e.target.value)}
                      className="ml-1.5 w-16 rounded-lg border border-slate-200 px-2 py-1 font-mono"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={mCountsLeague}
                      onChange={(e) => setMCountsLeague(e.target.checked)}
                      className="h-4 w-4 accent-pitch-700"
                    />
                    Suma en Tabla Anual
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-pitch-700/20 bg-pitch-50/40 p-3">
                    <p className="mb-2 text-xs font-extrabold text-pitch-800">
                      Equipo A ({teamAIds.length})
                    </p>
                    <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">
                      {dataset.players.slice(0, 28).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleTeamPlayer(p.id, "A")}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            teamAIds.includes(p.id)
                              ? "border-pitch-700 bg-pitch-700 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                          )}
                        >
                          {p.displayName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-navy-800/20 bg-navy-50/40 p-3">
                    <p className="mb-2 text-xs font-extrabold text-navy-800">
                      Equipo B ({teamBIds.length})
                    </p>
                    <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">
                      {dataset.players.slice(0, 28).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleTeamPlayer(p.id, "B")}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            teamBIds.includes(p.id)
                              ? "border-navy-800 bg-navy-800 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                          )}
                        >
                          {p.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={mvpId}
                    onChange={(e) => setMvpId(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="">Sin MVP asignado aún</option>
                    {[...teamAIds, ...teamBIds].map((id) => (
                      <option key={id} value={id}>
                        MVP: {dataset.players.find((p) => p.id === id)?.displayName}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={teamAIds.length === 0 || teamBIds.length === 0}
                    className="rounded-xl bg-pitch-700 px-4 py-2 text-xs font-bold text-white hover:bg-pitch-800 disabled:opacity-40"
                  >
                    Guardar Partido
                  </button>
                </div>

                {matchSavedMsg && (
                  <p className="rounded-xl bg-pitch-50 px-3 py-2 text-xs font-bold text-pitch-800">
                    {matchSavedMsg}
                  </p>
                )}
              </form>

              <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
                <h3 className="mb-2 text-xs font-extrabold uppercase text-slate-500">
                  Últimos partidos cargados
                </h3>
                <ul className="divide-y divide-slate-100 text-xs">
                  {dataset.matches.slice(0, 8).map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span>
                        <strong className="text-navy-900">
                          {m.matchType.toUpperCase()} #{m.matchNumber ?? "—"}
                        </strong>{" "}
                        · {m.matchDate} · {m.teamAScore ?? "-"}-{m.teamBScore ?? "-"}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteMatch(m.id)}
                        className="text-slate-400 hover:text-crimson-600"
                        title="Eliminar partido"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: ANNOUNCEMENTS & CALENDAR */}
          {safeTab === "announcements" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
                <h2 className="flex items-center gap-1.5 text-sm font-black text-navy-900">
                  <Megaphone className="h-4 w-4 text-pitch-700" />
                  Nuevo Anuncio
                </h2>
                <form onSubmit={handleAddAnnouncement} className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Título del anuncio"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    required
                  />
                  <textarea
                    placeholder="Mensaje para los jugadores..."
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    required
                  />
                  <label className="flex items-center gap-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={annPinned}
                      onChange={(e) => setAnnPinned(e.target.checked)}
                      className="h-4 w-4 accent-pitch-700"
                    />
                    Fijar arriba en Inicio
                  </label>
                  <button
                    type="submit"
                    className="rounded-xl bg-pitch-700 px-4 py-2 text-xs font-bold text-white"
                  >
                    Publicar Anuncio
                  </button>
                </form>

                <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs">
                  {dataset.announcements.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="font-semibold text-navy-900">
                        {a.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteAnnouncement(a.id)}
                        className="text-slate-400 hover:text-crimson-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
                <h2 className="flex items-center gap-1.5 text-sm font-black text-navy-900">
                  <CalendarPlus className="h-4 w-4 text-navy-800" />
                  Nuevo Evento de Calendario
                </h2>
                <form onSubmit={handleAddEvent} className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Ej. Fecha 40 - Liga / Descanso"
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={evDate}
                      onChange={(e) => setEvDate(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      required
                    />
                    <select
                      value={evType}
                      onChange={(e) =>
                        setEvType(e.target.value as CalendarEventType)
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                    >
                      <option value="league">Liga</option>
                      <option value="cup">Copa</option>
                      <option value="lolonmebol">Final LOLONMEBOL</option>
                      <option value="special_f11">F11 Especial</option>
                      <option value="rest">Descanso</option>
                      <option value="postponed">Aplazado</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-navy-800 px-4 py-2 text-xs font-bold text-white"
                  >
                    Agregar al Calendario
                  </button>
                </form>

                <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs">
                  {dataset.calendarEvents.slice(0, 6).map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span>
                        <strong>{ev.eventDate}</strong> · {ev.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteCalendarEvent(ev.id)}
                        className="text-slate-400 hover:text-crimson-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: CUP EDITOR (ADMIN ONLY) */}
          {safeTab === "cup" && isAdmin && <AdminCupTab />}

          {/* TAB 4: PLAYERS & STARS (ADMIN ONLY) */}
          {safeTab === "players" && isAdmin && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <form
                  onSubmit={handleAddPlayer}
                  className="space-y-2.5 rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs"
                >
                  <h2 className="text-sm font-black text-navy-900">
                    Alta de Jugador (Vinculación por Email)
                  </h2>
                  <input
                    type="text"
                    placeholder="Nombre visible (ej. Pedro)"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email para vinculación automática"
                    value={pEmail}
                    onChange={(e) => setPEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <select
                    value={pRole}
                    onChange={(e) =>
                      setPRole(e.target.value as Exclude<PlayerRole, "guest">)
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="player">Jugador</option>
                    <option value="authorized">Jugador Autorizado</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-xl bg-pitch-700 px-4 py-2 text-xs font-bold text-white"
                  >
                    Crear Jugador
                  </button>
                </form>

                <div className="space-y-2.5 rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
                  <h2 className="flex items-center gap-1.5 text-sm font-black text-navy-900">
                    <Star className="h-4 w-4 fill-gold-500 text-gold-600" />
                    Otorgar Estrella / Título Oficial (⭐)
                  </h2>
                  <select
                    value={titlePlayerId}
                    onChange={(e) => setTitlePlayerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    {dataset.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={titleType}
                    onChange={(e) => setTitleType(e.target.value as TitleType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                  >
                    <option value="league">Campeón de Liga (⭐)</option>
                    <option value="cup">Campeón de Copa (⭐)</option>
                    <option value="lolonmebol">Campeón LOLONMEBOL (⭐)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      addPlayerTitle(titlePlayerId, mSeasonId, titleType)
                    }
                    className="rounded-xl bg-gold-500 px-4 py-2 text-xs font-black text-navy-900 hover:bg-gold-400"
                  >
                    Sumar Estrella ⭐
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-pitch-700/15 bg-white p-4 shadow-xs">
                <h3 className="mb-2 text-xs font-extrabold uppercase text-slate-500">
                  Gestión de Roles ({dataset.players.length} jugadores)
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dataset.players.slice(0, 24).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="font-bold text-navy-900">
                        {p.displayName}
                      </span>
                      <select
                        value={p.role}
                        onChange={(e) =>
                          updatePlayerRole(
                            p.id,
                            e.target.value as Exclude<PlayerRole, "guest">
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold"
                      >
                        <option value="player">Jugador</option>
                        <option value="authorized">Autorizado</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: POZO (ADMIN ONLY) */}
          {safeTab === "pozo" && isAdmin && <AdminPozoTab />}

          {/* TAB 6: EXCEL IMPORTER (ADMIN ONLY) */}
          {safeTab === "excel" && isAdmin && <AdminExcelTab />}
        </>
      )}
    </div>
  );
}
