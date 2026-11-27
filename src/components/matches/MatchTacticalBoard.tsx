"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save, Star } from "lucide-react";
import type { MatchLedgerPlayerItem } from "@/lib/types/view-models";
import {
  clampTokenPosition,
  computeInitialFormation,
  type TokenPosition,
} from "@/lib/matches/tactical-board";
import { saveTacticalPositionsAction } from "@/server/actions/tactical";
import { cn } from "@/lib/utils";

interface MatchTacticalBoardProps {
  matchId: string;
  teamA: MatchLedgerPlayerItem[];
  teamB: MatchLedgerPlayerItem[];
  teamAScore?: number | null;
  teamBScore?: number | null;
  viewerPlayerId?: string | null;
  isOperator?: boolean;
}

export function MatchTacticalBoard({
  matchId,
  teamA,
  teamB,
  teamAScore,
  teamBScore,
  viewerPlayerId = null,
  isOperator = false,
}: MatchTacticalBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const initialPositions = useMemo(
    () => computeInitialFormation(teamA, teamB),
    [teamA, teamB]
  );

  const [positions, setPositions] =
    useState<Record<string, TokenPosition>>(initialPositions);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const editableTeams = useMemo(() => {
    const teams = new Set<"A" | "B">();
    if (isOperator) {
      teams.add("A");
      teams.add("B");
      return teams;
    }
    if (viewerPlayerId) {
      if (teamA.some((p) => p.playerId === viewerPlayerId && p.isCupCaptain)) {
        teams.add("A");
      }
      if (teamB.some((p) => p.playerId === viewerPlayerId && p.isCupCaptain)) {
        teams.add("B");
      }
    }
    return teams;
  }, [isOperator, teamA, teamB, viewerPlayerId]);

  const hasCustomPositions = useMemo(() => {
    for (const [id, initPos] of Object.entries(initialPositions)) {
      const cur = positions[id];
      if (!cur) continue;
      if (Math.abs(cur.x - initPos.x) > 0.5 || Math.abs(cur.y - initPos.y) > 0.5) {
        return true;
      }
    }
    return false;
  }, [initialPositions, positions]);

  const hasSaveableChanges = useMemo(() => {
    if (editableTeams.size === 0) return false;
    const editablePlayers = [
      ...(editableTeams.has("A") ? teamA : []),
      ...(editableTeams.has("B") ? teamB : []),
    ];
    for (const p of editablePlayers) {
      const initPos = initialPositions[p.id];
      const cur = positions[p.id];
      if (!initPos || !cur) continue;
      if (Math.abs(cur.x - initPos.x) > 0.5 || Math.abs(cur.y - initPos.y) > 0.5) {
        return true;
      }
    }
    return false;
  }, [editableTeams, initialPositions, positions, teamA, teamB]);

  const handleSaveOfficialFormation = () => {
    setFeedback(null);
    const editablePlayers = [
      ...(editableTeams.has("A") ? teamA : []),
      ...(editableTeams.has("B") ? teamB : []),
    ];

    const payload = editablePlayers
      .map((p) => {
        const cur = positions[p.id] ?? initialPositions[p.id];
        if (!cur) return null;
        return { playerId: p.playerId, x: cur.x, y: cur.y };
      })
      .filter((entry): entry is { playerId: string; x: number; y: number } =>
        Boolean(entry)
      );

    startTransition(async () => {
      const res = await saveTacticalPositionsAction({
        matchId,
        positions: payload,
      });
      if (!res.ok) {
        setFeedback({ type: "error", text: res.error });
        return;
      }
      setFeedback({
        type: "ok",
        text: res.message ?? "Formación oficial guardada.",
      });
      router.refresh();
    });
  };

  const updateFromPointer = (
    playerId: string,
    team: "A" | "B",
    clientX: number,
    clientY: number
  ) => {
    const el = pitchRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const clamped = clampTokenPosition(team, rawX, rawY);

    setPositions((prev) => ({
      ...prev,
      [playerId]: clamped,
    }));
  };

  if (teamA.length === 0 && teamB.length === 0) {
    return null;
  }

  const allTokens = [
    ...teamA.map((player, index) => ({
      player,
      team: "A" as const,
      number: index + 1,
    })),
    ...teamB.map((player, index) => ({
      player,
      team: "B" as const,
      number: index + 1,
    })),
  ];

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-ink">
            Pizarra táctica
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-full border border-white/80 bg-crimson-600" />
            Equipo A{teamAScore !== null && teamAScore !== undefined ? ` (${teamAScore})` : ""}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-full border border-pitch-950/60 bg-gold-400" />
            Equipo B{teamBScore !== null && teamBScore !== undefined ? ` (${teamBScore})` : ""}
          </span>
          <span className="hidden text-[11px] text-ink-muted sm:inline">
            {editableTeams.size > 0
              ? isOperator
                ? "· Podés mover fichas y guardar la formación oficial"
                : `· Como capitán podés guardar la formación de Equipo ${Array.from(editableTeams).join("/")}`
              : "· Arrastrá fichas para probar (solo visible en tu pantalla)"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasSaveableChanges && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveOfficialFormation}
              className="inline-flex min-h-10 items-center gap-1 rounded-md bg-pitch-800 px-3 text-xs font-bold text-white transition-colors hover:bg-pitch-900 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isOperator
                ? "Guardar formación"
                : `Guardar Eq. ${Array.from(editableTeams).join("/")}`}
            </button>
          )}
          {hasCustomPositions && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setPositions(initialPositions);
                setFeedback(null);
              }}
              className="inline-flex min-h-10 items-center gap-1 rounded-md border border-rule bg-surface px-3 text-xs font-bold text-ink transition-colors hover:bg-surface-subtle disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetear
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={cn(
            "mb-2 rounded-md border px-3 py-1.5 text-xs font-semibold",
            feedback.type === "ok"
              ? "border-pitch-700/40 bg-pitch-50 text-pitch-800"
              : "border-crimson-600/40 bg-crimson-50 text-crimson-700"
          )}
        >
          {feedback.text}
        </div>
      )}

      {/* Federation Pitch Tactical Board Frame */}
      <div className="mx-auto max-w-[440px] rounded-lg border-2 border-pitch-950 bg-pitch-900 p-1.5">
        <div
          ref={pitchRef}
          className="relative aspect-[3/4.35] w-full select-none overflow-hidden rounded-md border border-gold-500/35 bg-pitch-800"
        >
          {/* SVG Pitch Markings (Crisp Federation chalk-white lines) */}
          <svg
            viewBox="0 0 300 435"
            className="pointer-events-none absolute inset-0 h-full w-full text-paper opacity-45"
            aria-hidden="true"
          >
            {/* Outer touchline */}
            <rect
              x="16"
              y="16"
              width="268"
              height="403"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            {/* Halfway line */}
            <line
              x1="16"
              y1="217.5"
              x2="284"
              y2="217.5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            {/* Center circle */}
            <circle
              cx="150"
              cy="217.5"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            {/* Center spot */}
            <circle cx="150" cy="217.5" r="3" fill="currentColor" />

            {/* Top Penalty Box (Team A) */}
            <rect
              x="68"
              y="16"
              width="164"
              height="62"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <rect
              x="108"
              y="16"
              width="84"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M 118 78 A 34 34 0 0 0 182 78"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="150" cy="58" r="2" fill="currentColor" />

            {/* Bottom Penalty Box (Team B) */}
            <rect
              x="68"
              y="357"
              width="164"
              height="62"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <rect
              x="108"
              y="395"
              width="84"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M 118 357 A 34 34 0 0 1 182 357"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="150" cy="377" r="2" fill="currentColor" />

            {/* Corner arcs */}
            <path d="M 16 26 A 10 10 0 0 0 26 16" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M 274 16 A 10 10 0 0 0 284 26" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M 16 409 A 10 10 0 0 1 26 419" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M 274 419 A 10 10 0 0 1 284 409" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>

          {/* Subtle half labels */}
          <span className="pointer-events-none absolute top-1 left-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-paper opacity-65">
            Equipo A
          </span>
          <span className="pointer-events-none absolute bottom-1 left-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-paper opacity-65">
            Equipo B
          </span>

          {/* Draggable Magnetic Player Tokens */}
          {allTokens.map(({ player, team, number }) => {
            const pos = positions[player.id] ?? initialPositions[player.id];
            if (!pos) return null;
            const isDragging = draggingId === player.id;
            const isGk = number === 1;

            return (
              <div
                key={player.id}
                role="button"
                tabIndex={0}
                aria-label={`${player.displayName} (Equipo ${team}) — arrastrar para mover`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDraggingId(player.id);
                  updateFromPointer(player.id, team, e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (draggingId !== player.id) return;
                  updateFromPointer(player.id, team, e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  if (draggingId === player.id) {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    }
                    setDraggingId(null);
                  }
                }}
                onPointerCancel={() => {
                  if (draggingId === player.id) setDraggingId(null);
                }}
                onLostPointerCapture={() => {
                  if (draggingId === player.id) setDraggingId(null);
                }}
                onBlur={() => {
                  if (draggingId === player.id) setDraggingId(null);
                }}
                onKeyDown={(e) => {
                  const step = 4;
                  let dx = 0;
                  let dy = 0;
                  if (e.key === "ArrowLeft") dx = -step;
                  else if (e.key === "ArrowRight") dx = step;
                  else if (e.key === "ArrowUp") dy = -step;
                  else if (e.key === "ArrowDown") dy = step;
                  else return;
                  e.preventDefault();
                  setPositions((prev) => ({
                    ...prev,
                    [player.id]: clampTokenPosition(team, pos.x + dx, pos.y + dy),
                  }));
                }}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
                className={cn(
                  "touch-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-900",
                  isDragging
                    ? "z-30 cursor-grabbing scale-110"
                    : "z-10 cursor-grab hover:z-20"
                )}
              >
                {/* Magnetic disc */}
                <span
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-sm font-extrabold tabular-nums transition-transform",
                    isGk
                      ? "border-white bg-navy-700 text-white"
                      : team === "A"
                        ? "border-white/90 bg-crimson-600 text-white"
                        : "border-pitch-950 bg-gold-400 text-ink",
                    isDragging && "ring-2 ring-white"
                  )}
                >
                  {number}
                  {player.isMvp && (
                    <span
                      title="MVP"
                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-pitch-950 text-gold-400 ring-1 ring-white"
                    >
                      <Star className="h-2.5 w-2.5 fill-current" />
                    </span>
                  )}
                </span>
                {/* Nameplate */}
                <span className="mt-0.5 max-w-[84px] truncate rounded-sm border border-white/15 bg-pitch-950/90 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {player.displayName}
                  {player.goals > 0 ? ` (${player.goals}G)` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
