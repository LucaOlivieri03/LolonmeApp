"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  CheckCircle2,
  Eye,
  Lock,
  LockOpen,
  Star,
  Users,
} from "lucide-react";
import type {
  MatchLedgerItem,
  MatchVotingSummary,
} from "@/lib/types/view-models";
import {
  closeMatchVotingAction,
  openMatchVotingAction,
  submitMatchVotesAction,
} from "@/server/actions/voting";
import { cn } from "@/lib/utils";

interface MatchVotingPanelProps {
  match: MatchLedgerItem;
  summary: MatchVotingSummary;
  viewerPlayerId: string | null;
  isOperator: boolean;
}

const RATING_OPTIONS = [
  1, 2, 3, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10,
];

export function MatchVotingPanel({
  match,
  summary,
  viewerPlayerId,
  isOperator,
}: MatchVotingPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [showBallots, setShowBallots] = useState(false);

  const allPlayers = [...match.teamA, ...match.teamB];
  const votablePlayers = allPlayers.filter(
    (p) => p.playerId !== viewerPlayerId
  );

  const initialRatings: Record<string, number> = {};
  let initialMvp = "";
  for (const p of votablePlayers) {
    const existing = summary.viewerEntries.find(
      (e) => e.targetPlayerId === p.playerId
    );
    initialRatings[p.playerId] = existing?.rating ?? 6;
    if (existing?.votedMvp) {
      initialMvp = p.playerId;
    }
  }

  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings);
  const [mvpPlayerId, setMvpPlayerId] = useState<string>(initialMvp);

  const isOpen = summary.votingStatus === "open";
  const hasVotes = summary.totalVoters > 0;

  // Keep historical matches without votes clean for non-operators
  if (!isOpen && !hasVotes && !isOperator) {
    return null;
  }

  const handleOpenVoting = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await openMatchVotingAction({ matchId: match.id });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "ok",
        text: res.message ?? "Votación abierta.",
      });
      router.refresh();
    });
  };

  const handleCloseVoting = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await closeMatchVotingAction({
        matchId: match.id,
        applyVotedMvp: true,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "ok",
        text: res.message ?? "Votación cerrada y publicada.",
      });
      router.refresh();
    });
  };

  const handleSubmitBallot = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!mvpPlayerId) {
      setFeedback({
        type: "error",
        text: "Elegí exactamente un MVP del partido antes de enviar tu voto.",
      });
      return;
    }

    const entries = votablePlayers.map((p) => ({
      targetPlayerId: p.playerId,
      rating: ratings[p.playerId] ?? 6,
      votedMvp: p.playerId === mvpPlayerId,
    }));

    startTransition(async () => {
      const res = await submitMatchVotesAction({
        matchId: match.id,
        entries,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "ok",
        text: res.message ?? "Tu votación fue guardada.",
      });
      router.refresh();
    });
  };

  return (
    <section className="mt-4 rounded-lg border border-rule bg-surface p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display flex items-center gap-1.5 text-base font-bold uppercase tracking-wider text-ink">
            <Award className="h-4 w-4 text-leather-600" />
            Votación post-partido
          </h3>
          {isOpen ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-pitch-700/40 bg-pitch-50 px-2 py-0.5 text-[11px] font-bold text-pitch-800">
              <LockOpen className="h-3 w-3" />
              Abierta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-sm border border-rule bg-ledger px-2 py-0.5 text-[11px] font-bold text-ink-muted">
              <Lock className="h-3 w-3" />
              Cerrada
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted tabular-nums">
            <Users className="h-3.5 w-3.5" />
            {summary.totalVoters}/{summary.totalParticipants} votaron
          </span>
        </div>

        {isOperator && (
          <div className="flex items-center gap-2">
            {isOpen ? (
              <button
                type="button"
                disabled={isPending}
                onClick={handleCloseVoting}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-leather-600 px-3 text-xs font-bold text-white transition-colors hover:bg-leather-700 disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                Cerrar votación y publicar
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={handleOpenVoting}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-pitch-800 bg-paper px-3 text-xs font-bold text-pitch-800 transition-colors hover:bg-pitch-50 disabled:opacity-50"
              >
                <LockOpen className="h-3.5 w-3.5" />
                {hasVotes ? "Reabrir votación" : "Abrir votación"}
              </button>
            )}
          </div>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-xs font-semibold",
            feedback.type === "ok"
              ? "border-pitch-700/40 bg-pitch-50 text-pitch-800"
              : "border-crimson-600/40 bg-crimson-50 text-crimson-700"
          )}
        >
          {feedback.text}
        </div>
      )}

      {/* OPEN VOTING: PARTICIPANT BALLOT */}
      {isOpen && summary.canViewerVote && (
        <form onSubmit={handleSubmitBallot} className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <p>
              Calificá del 1 al 10 a tus compañeros y elegí{" "}
              <strong className="text-ink">1 MVP</strong>. No podés votarte a
              vos mismo. Los votos son secretos hasta el cierre.
            </p>
            {summary.hasViewerVoted && (
              <span className="inline-flex items-center gap-1 font-semibold text-pitch-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ya enviaste tu voto (podés editarlo)
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  label: "Equipo A",
                  players: match.teamA.filter(
                    (p) => p.playerId !== viewerPlayerId
                  ),
                },
                {
                  label: "Equipo B",
                  players: match.teamB.filter(
                    (p) => p.playerId !== viewerPlayerId
                  ),
                },
              ] as const
            ).map(({ label, players }) => (
              <div
                key={label}
                className="rounded-md border border-rule bg-paper p-2.5"
              >
                <p className="font-display mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {label}
                </p>
                <ul className="divide-y divide-rule/70">
                  {players.map((p) => {
                    const isSelectedMvp = mvpPlayerId === p.playerId;
                    return (
                      <li
                        key={p.playerId}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <span className="min-w-0 truncate text-sm font-semibold text-ink">
                          {p.displayName}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <select
                            aria-label={`Puntaje para ${p.displayName}`}
                            value={ratings[p.playerId] ?? 6}
                            onChange={(e) =>
                              setRatings((prev) => ({
                                ...prev,
                                [p.playerId]: Number(e.target.value),
                              }))
                            }
                            className="min-h-10 rounded-md border border-rule bg-surface px-2 text-base font-bold text-ink tabular-nums sm:text-sm"
                          >
                            {RATING_OPTIONS.map((val) => (
                              <option key={val} value={val}>
                                {val.toFixed(val % 1 === 0 ? 0 : 1)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setMvpPlayerId(p.playerId)}
                            aria-pressed={isSelectedMvp}
                            className={cn(
                              "inline-flex min-h-10 items-center gap-1 rounded-md border px-2.5 text-xs font-bold transition-colors",
                              isSelectedMvp
                                ? "border-leather-600 bg-leather-600 text-white"
                                : "border-rule bg-surface text-ink-muted hover:border-leather-600/60 hover:text-ink"
                            )}
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                isSelectedMvp && "fill-current"
                              )}
                            />
                            MVP
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-pitch-800 px-4 text-sm font-bold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {summary.hasViewerVoted ? "Actualizar mi voto" : "Enviar mi voto"}
            </button>
          </div>
        </form>
      )}

      {/* OPEN VOTING: NON-PARTICIPANT OR GUEST */}
      {isOpen && !summary.canViewerVote && (
        <div className="mt-3 rounded-md border border-rule bg-paper px-3 py-2.5 text-xs text-ink-muted">
          {!viewerPlayerId ? (
            <span>
              ¿Jugaste este partido?{" "}
              <Link
                href="/perfil"
                className="font-bold text-pitch-800 underline underline-offset-2"
              >
                Iniciá sesión en tu Perfil
              </Link>{" "}
              para cargar tus puntajes y votar al MVP.
            </span>
          ) : (
            <span>
              La votación está reservada para los jugadores que disputaron este
              partido. Los resultados serán públicos al cerrarse.
            </span>
          )}
        </div>
      )}

      {/* CLOSED (OR ADMIN PREVIEW): TRANSPARENT RESULTS */}
      {summary.playerSummaries.length > 0 && hasVotes && (
        <div className="mt-3 space-y-3">
          {isOpen && isOperator && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-leather-600">
              Vista previa de administración (invisible para jugadores hasta
              cerrar)
            </p>
          )}
          <div className="overflow-x-auto rounded-md border border-rule">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-rule bg-ledger text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Jugador</th>
                  <th className="px-2 py-2 text-center">Eq.</th>
                  <th className="px-2 py-2 text-right">Promedio</th>
                  <th className="px-3 py-2 text-right">Votos MVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/70 bg-surface">
                {summary.playerSummaries.map((row) => (
                  <tr
                    key={row.playerId}
                    className={cn(row.isTopMvp && "bg-gold-50/70")}
                  >
                    <td className="px-3 py-2 font-semibold text-ink">
                      {row.displayName}
                      {row.isTopMvp && (
                        <span className="ml-1.5 rounded-sm bg-leather-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                          MVP
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-ink-muted">
                      {row.team}
                    </td>
                    <td className="font-display px-2 py-2 text-right text-sm font-bold text-pitch-800 tabular-nums">
                      {row.averageRating !== null
                        ? row.averageRating.toFixed(2)
                        : "—"}
                    </td>
                    <td className="font-display px-3 py-2 text-right text-sm font-bold text-ink tabular-nums">
                      {row.mvpVotes > 0 ? row.mvpVotes : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {summary.transparentBallots.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowBallots((prev) => !prev)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rule bg-paper px-3 text-xs font-bold text-ink transition-colors hover:bg-ledger"
              >
                <Eye className="h-3.5 w-3.5 text-pitch-800" />
                {showBallots
                  ? "Ocultar detalle de votos"
                  : `Ver quién votó a quién (${summary.transparentBallots.length})`}
              </button>

              {showBallots && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {summary.transparentBallots.map((ballot) => (
                    <div
                      key={ballot.voterPlayerId}
                      className="rounded-md border border-rule bg-paper p-2.5 text-xs"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-rule/70 pb-1">
                        <span className="font-bold text-ink">
                          Voto de {ballot.voterName}
                        </span>
                        {ballot.mvpTargetName && (
                          <span className="rounded-sm bg-leather-600/15 px-1.5 py-0.5 text-[10px] font-extrabold text-leather-700">
                            MVP: {ballot.mvpTargetName}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-0.5">
                        {ballot.entries.map((entry) => (
                          <li
                            key={entry.targetPlayerId}
                            className="flex items-center justify-between text-ink-muted"
                          >
                            <span
                              className={cn(
                                entry.votedMvp && "font-bold text-ink"
                              )}
                            >
                              {entry.targetName}
                            </span>
                            <span className="font-display text-sm font-bold text-ink tabular-nums">
                              {entry.rating.toFixed(
                                entry.rating % 1 === 0 ? 0 : 1
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
