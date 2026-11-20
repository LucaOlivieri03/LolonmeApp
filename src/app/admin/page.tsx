"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  FileSpreadsheet,
  Lock,
  Megaphone,
  PlusCircle,
  Search,
  Shield,
  Star,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { useTournament } from "@/components/providers/TournamentProvider";
import { resolveDefaultSeasonId } from "@/lib/engine";
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
import { cn, formatDateEs } from "@/lib/utils";

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

const ROLE_SHORT_LABELS: Record<PlayerRole, string> = {
  admin: "Admin",
  authorized: "Autorizado",
  player: "Jugador",
  guest: "Invitado",
};

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  league: "Liga",
  league_tiebreaker: "Desempate Liga",
  cup: "Copa",
  lolonmebol: "Final LOLONMEBOL",
  special_f11: "Fecha Especial F11",
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
    addSeason,
  } = useTournament();

  const [activeTab, setActiveTab] = useState<AdminTab>("matches");
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);

  // Match & Season state
  const sortedSeasons = useMemo(
    () => [...dataset.seasons].sort((a, b) => b.year - a.year),
    [dataset.seasons]
  );
  const [rawMSeasonId, setMSeasonId] = useState(() =>
    resolveDefaultSeasonId(dataset.seasons)
  );
  const mSeasonId = resolveDefaultSeasonId(sortedSeasons, rawMSeasonId);

  // New Season form state (Admin only)
  const nextSuggestedYear =
    (sortedSeasons[0]?.year ?? new Date().getFullYear()) + 1;
  const [newSeasonYear, setNewSeasonYear] = useState(String(nextSuggestedYear));
  const [newSeasonFee, setNewSeasonFee] = useState("3000");
  const [newSeasonCutoff, setNewSeasonCutoff] = useState(
    `${nextSuggestedYear}-07-01`
  );
  const [seasonCreatedMsg, setSeasonCreatedMsg] = useState<string | null>(null);
  const [mType, setMType] = useState<MatchType>("league");
  const [mModality, setMModality] = useState<MatchModality>("F5");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));
  const [mNumber, setMNumber] = useState("");
  const [mScoreA, setMScoreA] = useState("8");
  const [mScoreB, setMScoreB] = useState("6");
  const [mCountsLeague, setMCountsLeague] = useState(true);
  const [teamAIds, setTeamAIds] = useState<string[]>([]);
  const [teamBIds, setTeamBIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
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
  const [roleSearch, setRoleSearch] = useState("");

  const isAdmin = role === "admin";
  const isOperator = role === "admin" || role === "authorized";

  const filteredTeamPlayers = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return dataset.players;
    return dataset.players.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [dataset.players, teamSearch]);

  const filteredRolePlayers = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return dataset.players;
    return dataset.players.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [dataset.players, roleSearch]);

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
    setMatchSavedMsg(
      "Partido guardado. Tablas y estadísticas recalculadas automáticamente."
    );
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

  const handleCreateSeason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const yearNum = Number(newSeasonYear);
    if (!Number.isFinite(yearNum) || yearNum < 2020 || yearNum > 2100) return;
    const feeNum = Number(newSeasonFee);
    const createdId = addSeason({
      year: yearNum,
      defaultFee: Number.isFinite(feeNum) ? feeNum : 3000,
      cupCutoffDate: newSeasonCutoff || `${yearNum}-07-01`,
    });
    setMSeasonId(createdId);
    const nextY = yearNum + 1;
    setNewSeasonYear(String(nextY));
    setNewSeasonCutoff(`${nextY}-07-01`);
    setSeasonCreatedMsg(
      `Temporada ${yearNum} habilitada con su Copa y 12 meses de Pozo.`
    );
  };

  return (
    <div className="space-y-5">
      {/* Header + Local Mode Role Switcher */}
      <header className="pitch-chalk-surface rounded-lg border border-pitch-900 p-4 text-paper">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Shield className="mt-0.5 h-6 w-6 shrink-0 text-gold-400" />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                Panel de Administración
              </h1>
              <p className="text-xs text-pitch-100">
                {isLocalMode
                  ? "Modo Local activo (sin Supabase conectado) · Simulador de roles"
                  : `Sesión autenticada · Rol actual: ${ROLE_LABELS[role]}`}
              </p>
            </div>
          </div>

          {isLocalMode && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Simular rol">
              {(["admin", "authorized", "player", "guest"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "min-h-10 rounded-md px-3 text-xs font-bold transition-colors",
                    role === r
                      ? "bg-gold-400 text-ink"
                      : "border border-white/20 bg-pitch-900/60 text-pitch-50 hover:bg-pitch-900"
                  )}
                >
                  {ROLE_SHORT_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {!isOperator ? (
        <div className="rounded-lg border border-crimson-600/35 bg-surface p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-crimson-600" />
          <h2 className="font-display mt-2 text-xl font-bold tracking-wide text-ink">
            Acceso Restringido ({ROLE_LABELS[role]})
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Solo los usuarios con rol <strong className="text-ink">Admin</strong> o{" "}
            <strong className="text-ink">Jugador Autorizado</strong> pueden operar el panel. Cambiá el rol arriba para probar permisos en modo local.
          </p>
        </div>
      ) : (
        <>
          {/* Admin Sub-Navigation */}
          <nav
            aria-label="Secciones de administración"
            className="flex flex-wrap gap-1.5 border-b border-rule pb-3"
          >
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3.5 text-sm font-semibold transition-colors",
                  safeTab === id
                    ? "border-pitch-800 bg-pitch-800 text-white"
                    : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Admin Season Management Bar */}
          {isAdmin && (
            <section className="rounded-lg border border-rule bg-surface p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold tracking-wide text-ink">
                    Temporadas Habilitadas ({sortedSeasons.map((s) => s.year).join(" · ")})
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Habilitá un nuevo año para que aparezca en todos los selectores, tablas, Copa y Pozo.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateSeason}
                  className="flex flex-wrap items-end gap-2"
                >
                  <div>
                    <label
                      htmlFor="admin-new-season-year"
                      className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
                    >
                      Año
                    </label>
                    <input
                      id="admin-new-season-year"
                      type="number"
                      min={2020}
                      max={2100}
                      value={newSeasonYear}
                      onChange={(e) => {
                        setNewSeasonYear(e.target.value);
                        if (/^\d{4}$/.test(e.target.value)) {
                          setNewSeasonCutoff(`${e.target.value}-07-01`);
                        }
                      }}
                      className="font-display mt-1 min-h-10 w-24 rounded-md border border-rule bg-paper px-2.5 text-base font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-new-season-fee"
                      className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
                    >
                      Cuota Pozo ($)
                    </label>
                    <input
                      id="admin-new-season-fee"
                      type="number"
                      min={0}
                      value={newSeasonFee}
                      onChange={(e) => setNewSeasonFee(e.target.value)}
                      className="font-display mt-1 min-h-10 w-28 rounded-md border border-rule bg-paper px-2.5 text-base font-bold text-ink"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="admin-new-season-cutoff"
                      className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted"
                    >
                      Corte Copa
                    </label>
                    <input
                      id="admin-new-season-cutoff"
                      type="date"
                      value={newSeasonCutoff}
                      onChange={(e) => setNewSeasonCutoff(e.target.value)}
                      className="mt-1 min-h-10 rounded-md border border-rule bg-paper px-2.5 text-sm text-ink"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-leather-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-leather-700"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Habilitar Año
                  </button>
                </form>
              </div>
              {seasonCreatedMsg && (
                <p className="mt-2.5 rounded-md border border-pitch-200 bg-pitch-50 px-3 py-2 text-xs font-semibold text-pitch-800">
                  {seasonCreatedMsg}
                </p>
              )}
            </section>
          )}

          {/* TAB 1: MATCHES */}
          {safeTab === "matches" && (
            <div className="space-y-4">
              <form
                onSubmit={handleCreateMatch}
                className="space-y-4 rounded-lg border border-rule bg-surface p-4"
              >
                <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
                  <PlusCircle className="h-5 w-5 text-pitch-700" />
                  Cargar Nuevo Partido
                </h2>

                <div className="grid gap-2.5 sm:grid-cols-5">
                  <select
                    aria-label="Temporada"
                    value={mSeasonId}
                    onChange={(e) => setMSeasonId(e.target.value)}
                    className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    {sortedSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Tipo de partido"
                    value={mType}
                    onChange={(e) => setMType(e.target.value as MatchType)}
                    className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    <option value="league">Liga</option>
                    <option value="cup">Copa</option>
                    <option value="special_f11">Fecha Especial F11</option>
                    <option value="league_tiebreaker">Desempate Liga</option>
                    <option value="lolonmebol">Final LOLONMEBOL</option>
                  </select>
                  <select
                    aria-label="Modalidad"
                    value={mModality}
                    onChange={(e) => setMModality(e.target.value as MatchModality)}
                    className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    <option value="F5">F5</option>
                    <option value="F6">F6</option>
                    <option value="F7">F7</option>
                    <option value="F11">F11</option>
                  </select>
                  <input
                    type="date"
                    aria-label="Fecha del partido"
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                    className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
                    required
                  />
                  <input
                    type="number"
                    aria-label="Número de fecha"
                    placeholder="N° Fecha"
                    value={mNumber}
                    onChange={(e) => setMNumber(e.target.value)}
                    className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-pitch-800">
                    Goles Eq. A
                    <input
                      type="number"
                      value={mScoreA}
                      onChange={(e) => setMScoreA(e.target.value)}
                      className="font-display min-h-11 w-16 rounded-md border border-rule bg-paper px-2 text-center text-lg font-bold text-ink"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-navy-800">
                    Goles Eq. B
                    <input
                      type="number"
                      value={mScoreB}
                      onChange={(e) => setMScoreB(e.target.value)}
                      className="font-display min-h-11 w-16 rounded-md border border-rule bg-paper px-2 text-center text-lg font-bold text-ink"
                    />
                  </label>
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={mCountsLeague}
                      onChange={(e) => setMCountsLeague(e.target.checked)}
                      className="h-4 w-4 accent-pitch-800"
                    />
                    Suma en Tabla Anual
                  </label>
                </div>

                <div className="space-y-2.5">
                  <div className="relative max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="search"
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Filtrar jugadores para armar equipos..."
                      className="min-h-10 w-full rounded-md border border-rule bg-paper pr-3 pl-9 text-base text-ink placeholder:text-ink-muted sm:text-sm"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-pitch-200 bg-pitch-50/40 p-3">
                      <p className="font-display mb-2 text-base font-bold text-pitch-800">
                        Equipo A ({teamAIds.length})
                      </p>
                      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                        {filteredTeamPlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={teamAIds.includes(p.id)}
                            onClick={() => toggleTeamPlayer(p.id, "A")}
                            className={cn(
                              "min-h-9 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                              teamAIds.includes(p.id)
                                ? "border-pitch-800 bg-pitch-800 text-white"
                                : "border-rule bg-surface text-ink hover:border-pitch-700"
                            )}
                          >
                            {p.displayName}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md border border-navy-100 bg-navy-50/40 p-3">
                      <p className="font-display mb-2 text-base font-bold text-navy-800">
                        Equipo B ({teamBIds.length})
                      </p>
                      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                        {filteredTeamPlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={teamBIds.includes(p.id)}
                            onClick={() => toggleTeamPlayer(p.id, "B")}
                            className={cn(
                              "min-h-9 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                              teamBIds.includes(p.id)
                                ? "border-navy-800 bg-navy-800 text-white"
                                : "border-rule bg-surface text-ink hover:border-navy-700"
                            )}
                          >
                            {p.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    aria-label="MVP del partido"
                    value={mvpId}
                    onChange={(e) => setMvpId(e.target.value)}
                    className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
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
                    className="min-h-11 rounded-md bg-pitch-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-40"
                  >
                    Guardar Partido
                  </button>
                </div>

                {matchSavedMsg && (
                  <p className="rounded-md border border-pitch-200 bg-pitch-50 px-3.5 py-2.5 text-sm font-semibold text-pitch-800">
                    {matchSavedMsg}
                  </p>
                )}
              </form>

              <section className="rounded-lg border border-rule bg-surface p-4">
                <h3 className="font-display mb-2 text-lg font-bold tracking-wide text-ink">
                  Últimos partidos cargados
                </h3>
                <ul className="divide-y divide-rule text-sm">
                  {dataset.matches.slice(0, 8).map((m) => {
                    const delKey = `match:${m.id}`;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-2 py-2.5"
                      >
                        <span className="min-w-0">
                          <strong className="text-ink">
                            {MATCH_TYPE_LABELS[m.matchType]}
                            {m.matchNumber !== null ? ` #${m.matchNumber}` : ""}
                          </strong>{" "}
                          <span className="text-ink-muted">
                            · {formatDateEs(m.matchDate)} ·{" "}
                          </span>
                          <span className="font-display text-base font-bold text-pitch-800">
                            {m.teamAScore ?? "—"}–{m.teamBScore ?? "—"}
                          </span>
                        </span>
                        {pendingDeleteKey === delKey ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                deleteMatch(m.id);
                                setPendingDeleteKey(null);
                              }}
                              className="min-h-9 rounded-md bg-crimson-600 px-2.5 text-xs font-bold text-white hover:bg-crimson-700"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteKey(null)}
                              className="min-h-9 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink-muted"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteKey(delKey)}
                            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-crimson-50 hover:text-crimson-600"
                            title="Eliminar partido"
                            aria-label="Eliminar partido"
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
          )}

          {/* TAB 2: ANNOUNCEMENTS & CALENDAR */}
          {safeTab === "announcements" && (
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
                    className="min-h-11 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
                  >
                    Publicar Anuncio
                  </button>
                </form>

                <ul className="divide-y divide-rule border-t border-rule pt-2 text-sm">
                  {dataset.announcements.map((a) => {
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
                              onClick={() => {
                                deleteAnnouncement(a.id);
                                setPendingDeleteKey(null);
                              }}
                              className="min-h-9 rounded-md bg-crimson-600 px-2.5 text-xs font-bold text-white"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteKey(null)}
                              className="min-h-9 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink-muted"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
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
                    value={mSeasonId}
                    onChange={(e) => setMSeasonId(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    {sortedSeasons.map((s) => (
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
                  <button
                    type="submit"
                    className="min-h-11 rounded-md bg-navy-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-900"
                  >
                    Agregar al Calendario
                  </button>
                </form>

                <ul className="divide-y divide-rule border-t border-rule pt-2 text-sm">
                  {dataset.calendarEvents.slice(0, 6).map((ev) => {
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
                              onClick={() => {
                                deleteCalendarEvent(ev.id);
                                setPendingDeleteKey(null);
                              }}
                              className="min-h-9 rounded-md bg-crimson-600 px-2.5 text-xs font-bold text-white"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteKey(null)}
                              className="min-h-9 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink-muted"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
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
          )}

          {/* TAB 3: CUP EDITOR (ADMIN ONLY) */}
          {safeTab === "cup" && isAdmin && <AdminCupTab />}

          {/* TAB 4: PLAYERS & STARS (ADMIN ONLY) */}
          {safeTab === "players" && isAdmin && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <form
                  onSubmit={handleAddPlayer}
                  className="space-y-3 rounded-lg border border-rule bg-surface p-4"
                >
                  <h2 className="font-display text-xl font-bold tracking-wide text-ink">
                    Alta de Jugador (Vinculación por Email)
                  </h2>
                  <input
                    type="text"
                    placeholder="Nombre visible (ej. Pedro)"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email para vinculación automática"
                    value={pEmail}
                    onChange={(e) => setPEmail(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
                  />
                  <select
                    value={pRole}
                    onChange={(e) =>
                      setPRole(e.target.value as Exclude<PlayerRole, "guest">)
                    }
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    <option value="player">Jugador</option>
                    <option value="authorized">Jugador Autorizado</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="submit"
                    className="min-h-11 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900"
                  >
                    Crear Jugador
                  </button>
                </form>

                <div className="space-y-3 rounded-lg border border-rule bg-surface p-4">
                  <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
                    <Star className="h-5 w-5 fill-gold-500 text-gold-600" />
                    Otorgar Estrella / Título Oficial
                  </h2>
                  <select
                    aria-label="Temporada del título"
                    value={mSeasonId}
                    onChange={(e) => setMSeasonId(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    {sortedSeasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={titlePlayerId}
                    onChange={(e) => setTitlePlayerId(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
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
                    className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base font-semibold text-ink sm:text-sm"
                  >
                    <option value="league">Campeón de Liga</option>
                    <option value="cup">Campeón de Copa</option>
                    <option value="lolonmebol">Campeón LOLONMEBOL</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      addPlayerTitle(titlePlayerId, mSeasonId, titleType)
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-gold-500 px-4 text-sm font-bold text-ink transition-colors hover:bg-gold-400"
                  >
                    <Star className="h-4 w-4 fill-ink text-ink" />
                    Sumar Estrella
                  </button>
                </div>
              </div>

              <section className="rounded-lg border border-rule bg-surface p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-wide text-ink">
                    Gestión de Roles ({dataset.players.length} jugadores)
                  </h3>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                    <input
                      type="search"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      placeholder="Buscar jugador..."
                      className="min-h-10 w-52 rounded-md border border-rule bg-paper pr-3 pl-9 text-base text-ink placeholder:text-ink-muted sm:text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRolePlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm"
                    >
                      <span className="truncate font-semibold text-ink">
                        {p.displayName}
                      </span>
                      <select
                        aria-label={`Rol de ${p.displayName}`}
                        value={p.role}
                        onChange={(e) =>
                          updatePlayerRole(
                            p.id,
                            e.target.value as Exclude<PlayerRole, "guest">
                          )
                        }
                        className="min-h-9 rounded-md border border-rule bg-surface px-2 text-xs font-semibold text-ink"
                      >
                        <option value="player">Jugador</option>
                        <option value="authorized">Autorizado</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              </section>
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
