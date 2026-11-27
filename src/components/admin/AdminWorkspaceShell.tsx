"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  FileSpreadsheet,
  Megaphone,
  PlusCircle,
  Shield,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { resolveDefaultSeasonId } from "@/lib/engine";
import type {
  Announcement,
  CalendarEvent,
  CupEdition,
  CupTie,
  FundMonth,
  FundPayment,
  FundTransaction,
  Match,
  Player,
  Season,
} from "@/lib/types/domain";
import type {
  AdminPendingLinkRequestItem,
  AdminPlayerAuthLinkInfo,
} from "@/lib/types/view-models";
import { cn } from "@/lib/utils";
import { createSeasonAction } from "@/server/actions/players";

function AdminTabSkeleton() {
  return (
    <div
      role="status"
      aria-label="Cargando sección..."
      className="space-y-3 rounded-lg border border-rule bg-surface p-4"
    >
      <div className="h-6 w-48 rounded-sm bg-surface-subtle motion-safe:animate-pulse" />
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className="h-11 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
        <div className="h-11 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
        <div className="h-11 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
      </div>
      <div className="h-24 rounded-md bg-surface-subtle motion-safe:animate-pulse" />
    </div>
  );
}

const AdminMatchesTab = dynamic(
  () =>
    import("@/components/admin/AdminMatchesTab").then(
      (mod) => mod.AdminMatchesTab
    ),
  { loading: () => <AdminTabSkeleton /> }
);

const AdminAnnouncementsTab = dynamic(
  () =>
    import("@/components/admin/AdminAnnouncementsTab").then(
      (mod) => mod.AdminAnnouncementsTab
    ),
  { loading: () => <AdminTabSkeleton /> }
);

const AdminCupTab = dynamic(
  () =>
    import("@/components/admin/AdminCupTab").then((mod) => mod.AdminCupTab),
  { loading: () => <AdminTabSkeleton /> }
);

const AdminPlayersTab = dynamic(
  () =>
    import("@/components/admin/AdminPlayersTab").then(
      (mod) => mod.AdminPlayersTab
    ),
  { loading: () => <AdminTabSkeleton /> }
);

const AdminPozoTab = dynamic(
  () =>
    import("@/components/admin/AdminPozoTab").then((mod) => mod.AdminPozoTab),
  { loading: () => <AdminTabSkeleton /> }
);

const AdminExcelTab = dynamic(
  () =>
    import("@/components/admin/AdminExcelTab").then((mod) => mod.AdminExcelTab),
  { loading: () => <AdminTabSkeleton /> }
);

type AdminTab =
  | "matches"
  | "announcements"
  | "cup"
  | "players"
  | "pozo"
  | "excel";

const ROLE_LABELS: Record<"admin" | "authorized", string> = {
  admin: "Admin (Presidente)",
  authorized: "Jugador Autorizado",
};

export interface AdminWorkspaceShellProps {
  session: {
    role: "admin" | "authorized";
    playerId: string | null;
    displayName: string | null;
  };
  data: {
    seasons: Season[];
    players: Array<Omit<Player, "email" | "userId">>;
    matches: Match[];
    announcements: Announcement[];
    calendarEvents: CalendarEvent[];
    cupEditions: CupEdition[];
    cupTies: CupTie[];
  };
  fund: {
    fundMonths: FundMonth[];
    fundPayments: FundPayment[];
    fundTransactions: FundTransaction[];
  } | null;
  pendingLinkRequests?: AdminPendingLinkRequestItem[] | null;
  playerAuthLinks?: Record<string, AdminPlayerAuthLinkInfo> | null;
}

export function AdminWorkspaceShell({
  session,
  data,
  fund,
  pendingLinkRequests = null,
  playerAuthLinks = null,
}: AdminWorkspaceShellProps) {
  const router = useRouter();
  const tabsId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<AdminTab>("matches");
  const [initialMatchId, setInitialMatchId] = useState<string | null>(null);

  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get("matchId");
    if (matchId) {
      setActiveTab("matches");
      setInitialMatchId(matchId);
    }
  }, []);

  const isAdmin = session.role === "admin";

  const sortedSeasons = useMemo(
    () => [...data.seasons].sort((a, b) => b.year - a.year),
    [data.seasons]
  );

  const defaultSeasonId = useMemo(
    () => resolveDefaultSeasonId(sortedSeasons),
    [sortedSeasons]
  );

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
  const [showSeasonManager, setShowSeasonManager] = useState(false);

  const parsedNewSeasonYear = Number(newSeasonYear);
  const isDuplicateSeasonYear =
    Number.isFinite(parsedNewSeasonYear) &&
    data.seasons.some((s) => s.year === Math.round(parsedNewSeasonYear));

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

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const count = visibleTabs.length;
    if (count <= 1) return;
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
    const nextTab = visibleTabs[nextIdx];
    if (nextTab) {
      setActiveTab(nextTab.id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  const handleCreateSeason = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const yearNum = Math.round(Number(newSeasonYear));
    if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) return;

    if (data.seasons.some((s) => s.year === yearNum)) {
      setSeasonCreatedMsg(null);
      setSeasonErrorMsg(
        `La temporada ${yearNum} ya está habilitada. Elegí un año nuevo.`
      );
      return;
    }

    const feeNum = Number(newSeasonFee);
    setSeasonErrorMsg(null);
    setSeasonCreatedMsg(null);

    startTransition(async () => {
      const res = await createSeasonAction({
        year: yearNum,
        defaultFee: Number.isFinite(feeNum) ? feeNum : 3000,
        cupCutoffDate: newSeasonCutoff || `${yearNum}-07-01`,
      });

      if (!res.ok) {
        setSeasonErrorMsg(res.error);
        return;
      }

      const maxAfterCreate = Math.max(
        yearNum,
        ...data.seasons.map((s) => s.year)
      );
      const nextY = maxAfterCreate + 1;
      setNewSeasonYear(String(nextY));
      setNewSeasonCutoff(`${nextY}-07-01`);
      setSeasonCreatedMsg(
        res.message ??
          `Temporada ${yearNum} habilitada con su Copa y 12 meses de Pozo.`
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <header className="pitch-chalk-surface rounded-lg border border-pitch-900 p-4 text-paper">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Shield className="mt-0.5 h-6 w-6 shrink-0 text-gold-400" />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                Panel de Administración
              </h1>
              <p className="text-xs text-pitch-100">
                Sesión autenticada
                {session.displayName ? ` · ${session.displayName}` : ""} · Rol:{" "}
                {ROLE_LABELS[session.role]}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Secciones de administración"
        className="flex flex-wrap gap-1.5 border-b border-rule pb-3"
      >
        {visibleTabs.map(({ id, label, icon: Icon }, idx) => {
          const isSelected = safeTab === id;
          const pendingCount =
            id === "players" && isAdmin
              ? (pendingLinkRequests?.length ?? 0)
              : 0;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`${tabsId}-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${tabsId}-panel-${id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3.5 text-sm font-semibold transition-colors",
                isSelected
                  ? "border-pitch-800 bg-pitch-800 text-white"
                  : "border-rule bg-surface text-ink-muted hover:border-rule-strong hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {pendingCount > 0 && (
                <span className="font-display ml-0.5 inline-flex min-w-5 items-center justify-center rounded-sm bg-leather-700 px-1.5 py-0.5 text-xs font-extrabold leading-none text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isAdmin && (
        <section className="overflow-hidden rounded-lg border border-rule bg-surface">
          <button
            type="button"
            aria-expanded={showSeasonManager}
            onClick={() => setShowSeasonManager((prev) => !prev)}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle"
          >
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-base font-bold tracking-wide text-ink">
                Temporadas · Habilitar año
              </span>
              <span className="text-xs font-medium text-ink-muted">
                ({sortedSeasons.map((s) => s.year).join(" · ")})
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-ink-muted transition-transform",
                showSeasonManager && "rotate-180 text-pitch-800"
              )}
            />
          </button>

          {showSeasonManager && (
            <div className="border-t border-rule p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <p className="text-xs text-ink-muted">
                  Habilitá un nuevo año para que aparezca en todos los selectores,
                  tablas, Copa y Pozo.
                </p>

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
                        "font-display mt-1 min-h-10 w-24 rounded-md border bg-paper px-2.5 text-base font-bold text-ink sm:text-sm",
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
                      className="font-display mt-1 min-h-10 w-28 rounded-md border border-rule bg-paper px-2.5 text-base font-bold text-ink sm:text-sm"
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
                      className="mt-1 min-h-10 rounded-md border border-rule bg-paper px-2.5 text-base text-ink sm:text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isPending || isDuplicateSeasonYear}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-leather-700 px-3.5 text-xs font-bold text-white transition-colors hover:bg-leather-700/90 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {isPending ? "Creando..." : "Habilitar Año"}
                  </button>
                </form>
              </div>
              {isDuplicateSeasonYear && !seasonErrorMsg && (
                <p
                  role="alert"
                  className="mt-2.5 rounded-md border border-crimson-600/35 bg-crimson-50 px-3 py-2 text-xs font-semibold text-crimson-700"
                >
                  La temporada {Math.round(parsedNewSeasonYear)} ya existe en el
                  sistema ({sortedSeasons.map((s) => s.year).join(", ")}). Ingresá
                  un año que no esté cargado.
                </p>
              )}
              {seasonErrorMsg && (
                <p
                  role="alert"
                  className="mt-2.5 rounded-md border border-crimson-600/35 bg-crimson-50 px-3 py-2 text-xs font-semibold text-crimson-700"
                >
                  {seasonErrorMsg}
                </p>
              )}
              {seasonCreatedMsg && (
                <p
                  role="status"
                  className="mt-2.5 rounded-md border border-pitch-200 bg-pitch-50 px-3 py-2 text-xs font-semibold text-pitch-800"
                >
                  {seasonCreatedMsg}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <div
        id={`${tabsId}-panel-${safeTab}`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${safeTab}`}
      >
        {safeTab === "matches" && (
          <AdminMatchesTab
            seasons={sortedSeasons}
            players={data.players}
            matches={data.matches}
            isAdmin={isAdmin}
            defaultSeasonId={defaultSeasonId}
            initialMatchId={initialMatchId}
          />
        )}

        {safeTab === "announcements" && (
          <AdminAnnouncementsTab
            seasons={sortedSeasons}
            matches={data.matches}
            announcements={data.announcements}
            calendarEvents={data.calendarEvents}
            defaultSeasonId={defaultSeasonId}
          />
        )}

        {safeTab === "cup" && isAdmin && (
          <AdminCupTab
            seasons={sortedSeasons}
            players={data.players}
            cupEditions={data.cupEditions}
            cupTies={data.cupTies}
          />
        )}

        {safeTab === "players" && isAdmin && (
          <AdminPlayersTab
            seasons={sortedSeasons}
            players={data.players}
            currentPlayerId={session.playerId}
            defaultSeasonId={defaultSeasonId}
            pendingLinkRequests={pendingLinkRequests ?? []}
            playerAuthLinks={playerAuthLinks ?? {}}
          />
        )}

        {safeTab === "pozo" && isAdmin && fund && (
          <AdminPozoTab
            seasons={sortedSeasons}
            players={data.players}
            fundMonths={fund.fundMonths}
            fundPayments={fund.fundPayments}
            fundTransactions={fund.fundTransactions}
          />
        )}

        {safeTab === "excel" && isAdmin && <AdminExcelTab />}
      </div>
    </div>
  );
}
