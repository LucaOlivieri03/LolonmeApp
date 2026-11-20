"use client";

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  FileSpreadsheet,
  Lock,
  Megaphone,
  Pencil,
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
import { filterMatches, resolveDefaultSeasonId } from "@/lib/engine";
import { MatchEditModal } from "@/components/tournament/MatchEditModal";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
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
    updateMatch,
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
  const [seasonErrorMsg, setSeasonErrorMsg] = useState<string | null>(null);

  const parsedNewSeasonYear = Number(newSeasonYear);
  const isDuplicateSeasonYear =
    Number.isFinite(parsedNewSeasonYear) &&
    dataset.seasons.some((s) => s.year === Math.round(parsedNewSeasonYear));
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
  const [adminMatchSeasonFilter, setAdminMatchSeasonFilter] =
    useState<string>("ALL");
  const [adminMatchNumberQuery, setAdminMatchNumberQuery] = useState("");
  const [adminMatchPlayerFilter, setAdminMatchPlayerFilter] = useState("ALL");
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Announcement form state
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annPinned, setAnnPinned] = useState(false);

  // Calendar event form state
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evMatchId, setEvMatchId] = useState("");
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

  const filteredTeamPlayers = dataset.players;

  const filteredRolePlayers = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return dataset.players;
    return dataset.players.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [dataset.players, roleSearch]);

  const adminFilteredMatches = useMemo(
    () =>
      filterMatches(dataset.matches, {
        seasonId: adminMatchSeasonFilter,
        matchType: "ALL",
        matchNumberQuery: adminMatchNumberQuery,
        playerId: adminMatchPlayerFilter,
      }),
    [
      dataset.matches,
      adminMatchSeasonFilter,
      adminMatchNumberQuery,
      adminMatchPlayerFilter,
    ]
  );

  const adminPlayerFilterOptions = useMemo(
    () => [
      {
        id: "ALL",
        displayName: `Todos los jugadores (${dataset.players.length})`,
      },
      ...dataset.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      })),
    ],
    [dataset.players]
  );

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
      description: evDesc.trim() || null,
      matchId: evMatchId || null,
      eventDate: evDate,
      eventType: evType,
    });
    setEvTitle("");
    setEvDesc("");
    setEvMatchId("");
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
    const yearNum = Math.round(Number(newSeasonYear));
    if (!Number.isFinite(yearNum) || yearNum < 2020 || yearNum > 2100) return;

    if (dataset.seasons.some((s) => s.year === yearNum)) {
      setSeasonCreatedMsg(null);
      setSeasonErrorMsg(
        `La temporada ${yearNum} ya está habilitada. Elegí un año nuevo.`
      );
      return;
    }

    const feeNum = Number(newSeasonFee);
    const res = addSeason({
      year: yearNum,
      defaultFee: Number.isFinite(feeNum) ? feeNum : 3000,
      cupCutoffDate: newSeasonCutoff || `${yearNum}-07-01`,
    });

    if (!res.ok) {
      setSeasonCreatedMsg(null);
      setSeasonErrorMsg(
        res.error ?? `La temporada ${yearNum} ya existe en el sistema.`
      );
      return;
    }

    setSeasonErrorMsg(null);
    setMSeasonId(res.seasonId);
    const maxAfterCreate = Math.max(
      yearNum,
      ...dataset.seasons.map((s) => s.year)
    );
    const nextY = maxAfterCreate + 1;
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
                        setSeasonErrorMsg(null);
                        setSeasonCreatedMsg(null);
                        if (/^\d{4}$/.test(e.target.value)) {
                          setNewSeasonCutoff(`${e.target.value}-07-01`);
                        }
                      }}
                      className={cn(
                        "font-display mt-1 min-h-10 w-24 rounded-md border bg-paper px-2.5 text-base font-bold text-ink",
                        isDuplicateSeasonYear
                          ? "border-crimson-600 text-crimson-700"
                          : "border-rule"
                      )}
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
                    disabled={isDuplicateSeasonYear}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-leather-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-leather-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Habilitar Año
                  </button>
                </form>
              </div>
              {isDuplicateSeasonYear && !seasonErrorMsg && (
                <p className="mt-2.5 rounded-md border border-crimson-600/35 bg-crimson-50 px-3 py-2 text-xs font-semibold text-crimson-700">
                  La temporada {Math.round(parsedNewSeasonYear)} ya existe en el sistema ({sortedSeasons.map((s) => s.year).join(", ")}). Ingresá un año que no esté cargado.
                </p>
              )}
              {seasonErrorMsg && (
                <p className="mt-2.5 rounded-md border border-crimson-600/35 bg-crimson-50 px-3 py-2 text-xs font-semibold text-crimson-700">
                  {seasonErrorMsg}
                </p>
              )}
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
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <PlayerCombobox
                      label="Buscar y sumar/quitar en Equipo A"
                      options={dataset.players.map((p) => ({
                        id: p.id,
                        displayName: p.displayName,
                        subtitle: teamAIds.includes(p.id)
                          ? "En Equipo A"
                          : teamBIds.includes(p.id)
                            ? "En Equipo B"
                            : undefined,
                      }))}
                      value={teamSearch}
                      onChange={(id) => {
                        setTeamSearch(id);
                        toggleTeamPlayer(id, "A");
                      }}
                      placeholder="Buscar jugador para Equipo A..."
                      searchPlaceholder="Buscar jugador..."
                    />
                    <PlayerCombobox
                      label="Buscar y sumar/quitar en Equipo B"
                      options={dataset.players.map((p) => ({
                        id: p.id,
                        displayName: p.displayName,
                        subtitle: teamBIds.includes(p.id)
                          ? "En Equipo B"
                          : teamAIds.includes(p.id)
                            ? "En Equipo A"
                            : undefined,
                      }))}
                      value={teamSearch}
                      onChange={(id) => {
                        setTeamSearch(id);
                        toggleTeamPlayer(id, "B");
                      }}
                      placeholder="Buscar jugador para Equipo B..."
                      searchPlaceholder="Buscar jugador..."
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

                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[230px] flex-1 sm:max-w-xs">
                    <PlayerCombobox
                      label="MVP del partido (opcional)"
                      options={[
                        { id: "", displayName: "Sin MVP asignado aún" },
                        ...[...teamAIds, ...teamBIds].map((id) => ({
                          id,
                          displayName:
                            dataset.players.find((p) => p.id === id)
                              ?.displayName ?? id,
                        })),
                      ]}
                      value={mvpId}
                      onChange={setMvpId}
                      placeholder="Sin MVP asignado aún"
                      searchPlaceholder="Buscar jugador del partido..."
                    />
                  </div>

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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-wide text-ink">
                    Todos los Partidos ({adminFilteredMatches.length})
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-56">
                      <PlayerCombobox
                        options={adminPlayerFilterOptions}
                        value={adminMatchPlayerFilter}
                        onChange={setAdminMatchPlayerFilter}
                        placeholder="Filtrar por jugador..."
                        searchPlaceholder="Buscar jugador..."
                      />
                    </div>
                    <select
                      aria-label="Filtrar temporada en admin"
                      value={adminMatchSeasonFilter}
                      onChange={(e) => setAdminMatchSeasonFilter(e.target.value)}
                      className="min-h-11 rounded-md border border-rule bg-paper px-2.5 text-xs font-semibold text-ink"
                    >
                      <option value="ALL">Todas las temporadas</option>
                      {sortedSeasons.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="search"
                      aria-label="Filtrar por número de fecha en admin"
                      placeholder="N° Fecha (ej. 12)"
                      value={adminMatchNumberQuery}
                      onChange={(e) => setAdminMatchNumberQuery(e.target.value)}
                      className="min-h-11 w-36 rounded-md border border-rule bg-paper px-2.5 text-xs text-ink"
                    />
                  </div>
                </div>
                <ul className="max-h-96 divide-y divide-rule overflow-y-auto text-sm">
                  {adminFilteredMatches.map((m) => {
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
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setEditingMatch(m)}
                              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rule bg-paper px-2.5 text-xs font-bold text-pitch-800 transition-colors hover:border-pitch-700 hover:bg-pitch-50"
                              title="Editar partido completo"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                          )}
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
                              className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-crimson-50 hover:text-crimson-600"
                              title="Eliminar partido"
                              aria-label="Eliminar partido"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
                    {dataset.matches
                      .filter((m) => m.seasonId === mSeasonId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {MATCH_TYPE_LABELS[m.matchType]}
                          {m.matchNumber !== null ? ` #${m.matchNumber}` : ""} ·{" "}
                          {formatDateEs(m.matchDate)} (
                          {m.teamAScore ?? "—"}–{m.teamBScore ?? "—"})
                        </option>
                      ))}
                  </select>
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
                  <PlayerCombobox
                    label="Jugador a premiar"
                    options={dataset.players.map((p) => ({
                      id: p.id,
                      displayName: p.displayName,
                    }))}
                    value={titlePlayerId}
                    onChange={setTitlePlayerId}
                    placeholder="Seleccionar jugador..."
                    searchPlaceholder="Buscar jugador..."
                  />
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
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <h3 className="font-display text-lg font-bold tracking-wide text-ink">
                    Gestión de Roles ({dataset.players.length} jugadores)
                  </h3>
                  <div className="w-full sm:w-72">
                    <PlayerCombobox
                      label="Filtrar jugador por nombre"
                      options={adminPlayerFilterOptions}
                      value={roleSearch || "ALL"}
                      onChange={(id) => setRoleSearch(id === "ALL" ? "" : id)}
                      placeholder="Todos los jugadores..."
                      searchPlaceholder="Buscar jugador..."
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dataset.players
                    .filter((p) => !roleSearch || p.id === roleSearch)
                    .map((p) => (
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

          {editingMatch && isAdmin && (
            <MatchEditModal
              match={editingMatch}
              seasons={sortedSeasons}
              players={dataset.players}
              onSave={(updated) => {
                updateMatch(updated);
                setEditingMatch(null);
                setMatchSavedMsg(
                  "Partido editado. Tablas y estadísticas recalculadas automáticamente."
                );
              }}
              onClose={() => setEditingMatch(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
