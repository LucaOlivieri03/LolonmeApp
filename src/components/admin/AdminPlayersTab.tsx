"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Mail,
  Save,
  Star,
  UserCheck,
  X,
} from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { resolveDefaultSeasonId } from "@/lib/engine";
import type {
  Player,
  PlayerRole,
  Season,
  TitleType,
} from "@/lib/types/domain";
import type {
  AdminPendingLinkRequestItem,
  AdminPlayerAuthLinkInfo,
  AdminPlayerLinkStatus,
} from "@/lib/types/view-models";
import { cn, formatDateEs } from "@/lib/utils";
import {
  approvePlayerLinkRequestAction,
  awardPlayerTitleAction,
  createPlayerAction,
  rejectPlayerLinkRequestAction,
  updatePlayerEmailAction,
  updatePlayerRoleAction,
} from "@/server/actions/players";

type PublicAdminPlayer = Omit<Player, "email" | "userId">;
type LinkStatusFilter = "ALL" | AdminPlayerLinkStatus;

const LINK_STATUS_BADGES: Record<
  AdminPlayerLinkStatus,
  { label: string; className: string }
> = {
  linked: {
    label: "Vinculado",
    className: "border-pitch-200 bg-pitch-50 text-pitch-800",
  },
  preloaded: {
    label: "Email precargado",
    className: "border-gold-500/40 bg-gold-50 text-ink",
  },
  unlinked: {
    label: "Sin vincular",
    className: "border-rule bg-surface text-ink-muted",
  },
};

interface AdminPlayersTabProps {
  seasons: Season[];
  players: PublicAdminPlayer[];
  currentPlayerId: string | null;
  defaultSeasonId: string;
  pendingLinkRequests?: AdminPendingLinkRequestItem[];
  playerAuthLinks?: Record<string, AdminPlayerAuthLinkInfo>;
}

export function AdminPlayersTab({
  seasons,
  players,
  currentPlayerId,
  defaultSeasonId,
  pendingLinkRequests = [],
  playerAuthLinks = {},
}: AdminPlayersTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rawSeasonId, setRawSeasonId] = useState(defaultSeasonId);
  const seasonId = resolveDefaultSeasonId(seasons, rawSeasonId);

  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pRole, setPRole] = useState<Exclude<PlayerRole, "guest">>("player");

  const [titlePlayerId, setTitlePlayerId] = useState(players[0]?.id ?? "");
  const [titleType, setTitleType] = useState<TitleType>("league");
  const [roleSearch, setRoleSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LinkStatusFilter>("ALL");

  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const playerFilterOptions = useMemo(
    () => [
      {
        id: "ALL",
        displayName: `Todos los jugadores (${players.length})`,
      },
      ...players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      })),
    ],
    [players]
  );

  const statusCounts = useMemo(() => {
    let linked = 0;
    let preloaded = 0;
    let unlinked = 0;
    for (const p of players) {
      const st = playerAuthLinks[p.id]?.status ?? "unlinked";
      if (st === "linked") linked++;
      else if (st === "preloaded") preloaded++;
      else unlinked++;
    }
    return { linked, preloaded, unlinked };
  }, [players, playerAuthLinks]);

  const filteredPlayers = useMemo(
    () =>
      players.filter((p) => {
        if (roleSearch && p.id !== roleSearch) return false;
        if (statusFilter !== "ALL") {
          const st = playerAuthLinks[p.id]?.status ?? "unlinked";
          if (st !== statusFilter) return false;
        }
        return true;
      }),
    [players, roleSearch, statusFilter, playerAuthLinks]
  );

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await createPlayerAction({
        displayName: pName.trim(),
        email: pEmail.trim() || null,
        role: pRole,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setPName("");
      setPEmail("");
      setPRole("player");
      setFeedback({
        type: "success",
        text: res.message ?? "Jugador agregado al padrón.",
      });
      router.refresh();
    });
  };

  const handleAwardTitle = () => {
    if (!titlePlayerId || !seasonId) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await awardPlayerTitleAction({
        playerId: titlePlayerId,
        seasonId,
        titleType,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message ?? "Estrella otorgada correctamente.",
      });
      router.refresh();
    });
  };

  const handleRoleChange = (
    playerId: string,
    role: Exclude<PlayerRole, "guest">
  ) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updatePlayerRoleAction({ playerId, role });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message ?? "Rol actualizado.",
      });
      router.refresh();
    });
  };

  const handleSaveEmail = (playerId: string, currentSavedEmail: string) => {
    const draft = emailDrafts[playerId] ?? currentSavedEmail;
    setFeedback(null);
    startTransition(async () => {
      const res = await updatePlayerEmailAction({
        playerId,
        email: draft.trim() || null,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setEmailDrafts((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      setFeedback({
        type: "success",
        text: res.message ?? "Email actualizado.",
      });
      router.refresh();
    });
  };

  const handleApproveRequest = (requestId: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await approvePlayerLinkRequestAction({ requestId });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message ?? "Solicitud aprobada y jugador vinculado.",
      });
      router.refresh();
    });
  };

  const handleRejectRequest = (requestId: string) => {
    const note = rejectNotes[requestId]?.trim() || null;
    setFeedback(null);
    startTransition(async () => {
      const res = await rejectPlayerLinkRequestAction({
        requestId,
        reviewNote: note,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setRejectNotes((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      setFeedback({
        type: "success",
        text: res.message ?? "Solicitud rechazada.",
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
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

      {/* Pending Player Link Requests Queue (Admin-only) */}
      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
            <Clock className="h-5 w-5 text-leather-600" />
            Solicitudes de vinculación pendientes
            <span
              className={cn(
                "font-display inline-flex min-w-6 items-center justify-center rounded-sm px-2 py-0.5 text-sm font-extrabold",
                pendingLinkRequests.length > 0
                  ? "bg-leather-700 text-white"
                  : "bg-paper text-ink-muted"
              )}
            >
              {pendingLinkRequests.length}
            </span>
          </h2>
          <span className="text-xs text-ink-muted">
            Aprobar vincula la cuenta con la ficha del padrón y descarta pedidos
            duplicados
          </span>
        </div>

        {pendingLinkRequests.length === 0 ? (
          <p className="py-4 text-xs text-ink-muted">
            No hay solicitudes de vinculación pendientes de aprobación.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-rule">
            {pendingLinkRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    <span className="font-bold text-ink">
                      {req.requestedPlayerName}
                    </span>
                    <span className="text-xs text-ink-muted">←</span>
                    <span className="truncate font-semibold text-pitch-800">
                      {req.email}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Solicitado el {formatDateEs(req.createdAt.slice(0, 10))}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Nota opcional para ${req.email}`}
                    placeholder="Motivo rechazo (opcional)"
                    value={rejectNotes[req.id] ?? ""}
                    onChange={(e) =>
                      setRejectNotes((prev) => ({
                        ...prev,
                        [req.id]: e.target.value,
                      }))
                    }
                    className="min-h-10 w-full rounded-md border border-rule bg-paper px-2.5 text-base text-ink sm:w-48 sm:text-xs"
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleApproveRequest(req.id)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-pitch-800 px-3.5 text-xs font-bold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRejectRequest(req.id)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-crimson-600/35 bg-crimson-50 px-3.5 text-xs font-bold text-crimson-700 transition-colors hover:bg-crimson-100 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
            aria-label="Nombre visible del jugador"
            placeholder="Nombre visible (ej. Pedro)"
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
            required
          />
          <input
            type="email"
            aria-label="Email del jugador para vinculación con Google"
            placeholder="Email para vinculación automática con Google"
            value={pEmail}
            onChange={(e) => setPEmail(e.target.value)}
            className="min-h-11 w-full rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
          />
          <select
            aria-label="Rol del jugador"
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
            disabled={isPending}
            className="min-h-11 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
          >
            {isPending ? "Creando..." : "Crear Jugador"}
          </button>
        </form>

        <div className="space-y-3 rounded-lg border border-rule bg-surface p-4">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
            <Star className="h-5 w-5 fill-gold-500 text-gold-700" />
            Otorgar Estrella / Título Oficial
          </h2>
          <select
            aria-label="Temporada del título"
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
          <PlayerCombobox
            label="Jugador a premiar"
            options={players.map((p) => ({
              id: p.id,
              displayName: p.displayName,
            }))}
            value={titlePlayerId}
            onChange={setTitlePlayerId}
            placeholder="Seleccionar jugador..."
            searchPlaceholder="Buscar jugador..."
          />
          <select
            aria-label="Tipo de título oficial"
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
            disabled={isPending || !titlePlayerId}
            onClick={handleAwardTitle}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-gold-500 px-4 text-sm font-bold text-ink transition-colors hover:bg-gold-400 disabled:opacity-50"
          >
            <Star className="h-4 w-4 fill-current" />
            Sumar Estrella
          </button>
        </div>
      </div>

      {/* Roster Roles, Link Status & Preloaded Emails (Admin-only) */}
      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="mb-3 flex flex-col gap-3 border-b border-rule pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h3 className="font-display flex items-center gap-2 text-lg font-bold tracking-wide text-ink">
              <UserCheck className="h-4 w-4 text-pitch-700" />
              Padrón: Roles, Vinculación y Emails ({players.length} jugadores)
            </h3>
            <div
              role="group"
              aria-label="Filtrar por estado de vinculación"
              className="flex flex-wrap gap-1.5"
            >
              {(
                [
                  { id: "ALL", label: `Todos (${players.length})` },
                  {
                    id: "unlinked",
                    label: `Sin vincular (${statusCounts.unlinked})`,
                  },
                  {
                    id: "preloaded",
                    label: `Email precargado (${statusCounts.preloaded})`,
                  },
                  {
                    id: "linked",
                    label: `Vinculado (${statusCounts.linked})`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={statusFilter === pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={cn(
                    "min-h-10 rounded-md border px-2.5 text-xs font-bold transition-colors",
                    statusFilter === pill.id
                      ? "border-pitch-800 bg-pitch-800 text-white"
                      : "border-rule bg-paper text-ink-muted hover:text-ink"
                  )}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-72">
            <PlayerCombobox
              label="Filtrar jugador por nombre"
              options={playerFilterOptions}
              value={roleSearch || "ALL"}
              onChange={(id) => setRoleSearch(id === "ALL" ? "" : id)}
              placeholder="Todos los jugadores..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>
        </div>

        <div className="divide-y divide-rule">
          {filteredPlayers.length === 0 ? (
            <p className="py-4 text-xs text-ink-muted">
              No hay jugadores que coincidan con el filtro seleccionado.
            </p>
          ) : (
            filteredPlayers.map((p) => {
              const isSelf =
                currentPlayerId !== null && p.id === currentPlayerId;
              const linkInfo = playerAuthLinks[p.id];
              const linkStatus: AdminPlayerLinkStatus =
                linkInfo?.status ?? "unlinked";
              const savedEmail = linkInfo?.email ?? "";
              const draftEmail =
                emailDrafts[p.id] !== undefined
                  ? emailDrafts[p.id]
                  : savedEmail;
              const isEmailDirty =
                draftEmail.trim().toLowerCase() !==
                savedEmail.trim().toLowerCase();
              const badge = LINK_STATUS_BADGES[linkStatus];

              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-2.5 py-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">
                      {p.displayName}
                      {isSelf ? " (vos)" : ""}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-bold",
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-1.5 sm:w-80">
                      <Mail className="hidden h-4 w-4 shrink-0 text-ink-muted sm:block" />
                      <input
                        type="email"
                        aria-label={`Email de ${p.displayName}`}
                        placeholder="Precargar email (auto-vínculo)"
                        value={draftEmail}
                        onChange={(e) =>
                          setEmailDrafts((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        className="min-h-10 min-w-0 flex-1 rounded-md border border-rule bg-paper px-2.5 text-base text-ink focus:border-pitch-700 sm:text-xs"
                      />
                      <button
                        type="button"
                        disabled={isPending || !isEmailDirty}
                        onClick={() => handleSaveEmail(p.id, savedEmail)}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md bg-pitch-800 px-3 text-xs font-bold text-white transition-colors hover:bg-pitch-900 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Guardar
                      </button>
                    </div>

                    <select
                      aria-label={`Rol de ${p.displayName}`}
                      value={p.role}
                      disabled={isPending || isSelf}
                      onChange={(e) =>
                        handleRoleChange(
                          p.id,
                          e.target.value as Exclude<PlayerRole, "guest">
                        )
                      }
                      className="min-h-10 rounded-md border border-rule bg-paper px-2.5 text-base font-semibold text-ink disabled:opacity-60 sm:text-xs"
                    >
                      <option value="player">Jugador</option>
                      <option value="authorized">Autorizado</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
