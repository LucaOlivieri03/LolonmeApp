"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trophy } from "lucide-react";
import { PlayerCombobox } from "@/components/tournament/PlayerCombobox";
import { resolveDefaultSeasonId } from "@/lib/engine";
import type { CupEdition, CupTie, Player, Season } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import {
  regenerateCupBracketAction,
  updateCupTieAction,
} from "@/server/actions/cup";

const ROUND_LABELS: Record<string, string> = {
  preliminary: "Fase Previa",
  quarterfinal: "Cuartos de Final",
  semifinal: "Semifinales",
  final: "Final de Copa",
  lolonmebol: "Final LOLONMEBOL",
};

interface AdminCupTabProps {
  seasons: Season[];
  players: Player[];
  cupEditions: CupEdition[];
  cupTies: CupTie[];
}

export function AdminCupTab({
  seasons,
  players,
  cupEditions,
  cupTies,
}: AdminCupTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const sortedSeasons = useMemo(
    () => [...seasons].sort((a, b) => b.year - a.year),
    [seasons]
  );

  const [selectedSeasonId, setSeasonId] = useState(() =>
    resolveDefaultSeasonId(seasons)
  );
  const seasonId = resolveDefaultSeasonId(sortedSeasons, selectedSeasonId);
  const [finalist1, setFinalist1] = useState("b-aguzzi");
  const [finalist2, setFinalist2] = useState("pipo");
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const edition = cupEditions.find((e) => e.seasonId === seasonId);
  const ties = cupTies.filter((t) => t.cupEditionId === edition?.id);

  const playerOptions = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
      })),
    [players]
  );

  const tiePlayerOptions = useMemo(
    () => [
      { id: "", displayName: "— Sin asignar —", subtitle: "Vacante" },
      ...playerOptions,
    ],
    [playerOptions]
  );

  const handleRegenerate = () => {
    setFeedback(null);
    setConfirmRegenerate(false);
    startTransition(async () => {
      const res = await regenerateCupBracketAction({
        seasonId,
        previousFinalists: [finalist1, finalist2],
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message ?? "Cuadro de Copa regenerado.",
      });
      router.refresh();
    });
  };

  const handleTiePatch = (
    tieId: string,
    patch: Parameters<typeof updateCupTieAction>[0]["patch"]
  ) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateCupTieAction({ tieId, patch });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "success",
        text: res.message ?? "Llave de Copa actualizada.",
      });
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

      <section className="rounded-lg border border-rule bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-wide text-ink">
                Editor Manual de Copa
              </h2>
              <p className="text-xs text-ink-muted">
                Generá el cuadro automático por tabla o editá jugadores, puntajes globales y ganadores por baja o reemplazo.
              </p>
            </div>
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Temporada de Copa">
            {sortedSeasons.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSeasonId(s.id);
                  setConfirmRegenerate(false);
                }}
                className={cn(
                  "font-display min-h-10 rounded-md border px-3.5 text-base font-bold transition-colors",
                  seasonId === s.id
                    ? "border-leather-600 bg-leather-600 text-white"
                    : "border-rule bg-paper text-ink-muted hover:text-ink"
                )}
              >
                {s.year}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule pt-4">
          <div className="min-w-[200px] flex-1">
            <PlayerCombobox
              label="Finalista LOLONMEBOL ant. #1"
              options={playerOptions}
              value={finalist1}
              onChange={setFinalist1}
              placeholder="Elegir finalista #1..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <PlayerCombobox
              label="Finalista LOLONMEBOL ant. #2"
              options={playerOptions}
              value={finalist2}
              onChange={setFinalist2}
              placeholder="Elegir finalista #2..."
              searchPlaceholder="Buscar jugador..."
            />
          </div>
          {confirmRegenerate ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-crimson-600/35 bg-crimson-50 px-3 py-2">
              <span className="text-xs font-semibold text-crimson-700">
                Esto sobrescribirá las ediciones manuales del cuadro actual.
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRegenerate}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-crimson-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-crimson-700 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
                {isPending ? "Generando..." : "Confirmar regeneración"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmRegenerate(false)}
                className="min-h-10 rounded-md border border-rule bg-surface px-3 text-xs font-semibold text-ink-muted hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (ties.length > 0) {
                  setConfirmRegenerate(true);
                } else {
                  handleRegenerate();
                }
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
              {isPending ? "Generando..." : "Generar / Regenerar Cuadro"}
            </button>
          )}
        </div>
      </section>

      {ties.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center text-sm text-ink-muted">
          No hay llaves generadas para esta temporada. Usá &ldquo;Generar / Regenerar Cuadro&rdquo; arriba.
        </div>
      ) : (
        <div className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-surface">
          {ties.map((tie) => (
            <CupTieRow
              key={`${tie.id}-${tie.overrideScoreA ?? ""}-${tie.overrideScoreB ?? ""}-${tie.notes ?? ""}`}
              tie={tie}
              players={players}
              tiePlayerOptions={tiePlayerOptions}
              isPending={isPending}
              onPatch={handleTiePatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CupTieRowProps {
  tie: CupTie;
  players: Player[];
  tiePlayerOptions: Array<{ id: string; displayName: string; subtitle?: string }>;
  isPending: boolean;
  onPatch: (
    tieId: string,
    patch: Parameters<typeof updateCupTieAction>[0]["patch"]
  ) => void;
}

function CupTieRow({
  tie,
  players,
  tiePlayerOptions,
  isPending,
  onPatch,
}: CupTieRowProps) {
  const [scoreA, setScoreA] = useState(
    tie.overrideScoreA !== null ? String(tie.overrideScoreA) : ""
  );
  const [scoreB, setScoreB] = useState(
    tie.overrideScoreB !== null ? String(tie.overrideScoreB) : ""
  );
  const [notes, setNotes] = useState(tie.notes ?? "");

  const commitScoreA = () => {
    const next = scoreA.trim() === "" ? null : Number(scoreA);
    if (next === tie.overrideScoreA) return;
    if (next !== null && !Number.isFinite(next)) return;
    onPatch(tie.id, { overrideScoreA: next });
  };

  const commitScoreB = () => {
    const next = scoreB.trim() === "" ? null : Number(scoreB);
    if (next === tie.overrideScoreB) return;
    if (next !== null && !Number.isFinite(next)) return;
    onPatch(tie.id, { overrideScoreB: next });
  };

  const commitNotes = () => {
    const next = notes.trim() || null;
    if (next === (tie.notes ?? null)) return;
    onPatch(tie.id, { notes: next });
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display rounded-sm border border-pitch-200 bg-pitch-50 px-2.5 py-0.5 text-sm font-bold uppercase tracking-wider text-pitch-800">
          {ROUND_LABELS[tie.round]} #{tie.slotOrder}
        </span>
        <span className="text-xs font-medium text-ink-muted">
          Seeds: {tie.seedA ?? "—"} vs {tie.seedB ?? "—"}
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <PlayerCombobox
              options={tiePlayerOptions}
              value={tie.playerAId ?? ""}
              onChange={(id) => onPatch(tie.id, { playerAId: id || null })}
              placeholder="— Jugador A —"
              searchPlaceholder="Buscar Jugador A..."
            />
          </div>
          <input
            type="number"
            min={0}
            aria-label="Global Jugador A"
            placeholder="Glob A"
            disabled={isPending}
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            onBlur={commitScoreA}
            className="font-display min-h-11 w-20 rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <PlayerCombobox
              options={tiePlayerOptions}
              value={tie.playerBId ?? ""}
              onChange={(id) => onPatch(tie.id, { playerBId: id || null })}
              placeholder="— Jugador B —"
              searchPlaceholder="Buscar Jugador B..."
            />
          </div>
          <input
            type="number"
            min={0}
            aria-label="Global Jugador B"
            placeholder="Glob B"
            disabled={isPending}
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            onBlur={commitScoreB}
            className="font-display min-h-11 w-20 rounded-md border border-rule bg-paper px-2 text-center text-base font-bold text-ink"
          />
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <select
          aria-label="Override ganador"
          disabled={isPending}
          value={tie.winnerPlayerId ?? ""}
          onChange={(e) =>
            onPatch(tie.id, { winnerPlayerId: e.target.value || null })
          }
          className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink sm:text-sm"
        >
          <option value="">Ganador automático (global / ventaja)</option>
          {tie.playerAId && (
            <option value={tie.playerAId}>
              Override ganador:{" "}
              {players.find((p) => p.id === tie.playerAId)?.displayName}
            </option>
          )}
          {tie.playerBId && (
            <option value={tie.playerBId}>
              Override ganador:{" "}
              {players.find((p) => p.id === tie.playerBId)?.displayName}
            </option>
          )}
        </select>

        <input
          type="text"
          aria-label="Nota de la llave"
          placeholder="Nota (ej. Baja por lesión, ingresa reemplazo)"
          disabled={isPending}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          className="min-h-11 rounded-md border border-rule bg-paper px-3 text-base text-ink placeholder:text-ink-muted sm:text-sm"
        />
      </div>
    </div>
  );
}
