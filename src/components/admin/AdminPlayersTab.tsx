"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { resolveDefaultSeasonId } from "@/lib/engine";
import type { Player, PlayerRole, Season, TitleType } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import {
  awardPlayerTitleAction,
  createPlayerAction,
  updatePlayerRoleAction,
} from "@/server/actions/players";

interface AdminPlayersTabProps {
  seasons: Season[];
  players: Player[];
  currentPlayerId: string | null;
  defaultSeasonId: string;
}

export function AdminPlayersTab({
  seasons,
  players,
  currentPlayerId,
  defaultSeasonId,
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
      setFeedback({ type: "success", text: res.message ?? "Rol actualizado." });
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
            disabled={isPending}
            className="min-h-11 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
          >
            {isPending ? "Creando..." : "Crear Jugador"}
          </button>
        </form>

        <div className="space-y-3 rounded-lg border border-rule bg-surface p-4">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold tracking-wide text-ink">
            <Star className="h-5 w-5 fill-gold-500 text-gold-600" />
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
            <Star className="h-4 w-4 fill-ink text-ink" />
            Sumar Estrella
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-display text-lg font-bold tracking-wide text-ink">
            Gestión de Roles ({players.length} jugadores)
          </h3>
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {players
            .filter((p) => !roleSearch || p.id === roleSearch)
            .map((p) => {
              const isSelf = currentPlayerId !== null && p.id === currentPlayerId;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm"
                >
                  <span className="truncate font-semibold text-ink">
                    {p.displayName}
                    {isSelf ? " (vos)" : ""}
                  </span>
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
                    className="min-h-9 rounded-md border border-rule bg-surface px-2 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    <option value="player">Jugador</option>
                    <option value="authorized">Autorizado</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
