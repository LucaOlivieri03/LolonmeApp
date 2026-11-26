"use client";

import { useMemo, useRef, useState } from "react";
import { RotateCcw, Star } from "lucide-react";
import type { MatchLedgerPlayerItem } from "@/lib/types/view-models";
import {
  clampTokenPosition,
  computeInitialFormation,
  type TokenPosition,
} from "@/lib/matches/tactical-board";
import { cn } from "@/lib/utils";

interface MatchTacticalBoardProps {
  teamA: MatchLedgerPlayerItem[];
  teamB: MatchLedgerPlayerItem[];
  teamAScore?: number | null;
  teamBScore?: number | null;
}

export function MatchTacticalBoard({
  teamA,
  teamB,
  teamAScore,
  teamBScore,
}: MatchTacticalBoardProps) {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const initialPositions = useMemo(
    () => computeInitialFormation(teamA, teamB),
    [teamA, teamB]
  );

  const [positions, setPositions] =
    useState<Record<string, TokenPosition>>(initialPositions);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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
            <span className="h-2.5 w-2.5 rounded-full border border-white/80 bg-[#d92626]" />
            Equipo A{teamAScore !== null && teamAScore !== undefined ? ` (${teamAScore})` : ""}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-full border border-[#111c15]/50 bg-[#ecc21c]" />
            Equipo B{teamBScore !== null && teamBScore !== undefined ? ` (${teamBScore})` : ""}
          </span>
          <span className="hidden text-[11px] text-ink-muted sm:inline">
            · Arrastrá cada ficha dentro de su mitad
          </span>
        </div>

        {hasCustomPositions && (
          <button
            type="button"
            onClick={() => setPositions(initialPositions)}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-rule bg-surface px-2.5 text-xs font-bold text-ink transition-colors hover:bg-ledger"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetear
          </button>
        )}
      </div>

      {/* Magnetic Coach Tactical Board Frame */}
      <div className="mx-auto max-w-[440px] rounded-xl border-[5px] border-[#1a1c1b] bg-[#2a271f] p-1.5 shadow-sm ring-1 ring-[#c89b3c]/50">
        <div
          ref={pitchRef}
          className="relative aspect-[3/4.35] w-full select-none overflow-hidden rounded-lg"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, #6aa826 0%, #6aa826 10%, #5c991e 10%, #5c991e 20%)",
          }}
        >
          {/* SVG Pitch Markings (Coach Board crisp dark-ink lines) */}
          <svg
            viewBox="0 0 300 435"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {/* Outer touchline */}
            <rect
              x="16"
              y="16"
              width="268"
              height="403"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            {/* Halfway line */}
            <line
              x1="16"
              y1="217.5"
              x2="284"
              y2="217.5"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            {/* Center circle */}
            <circle
              cx="150"
              cy="217.5"
              r="36"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            {/* Center ball / spot */}
            <circle
              cx="150"
              cy="217.5"
              r="6"
              fill="#f7f7f5"
              stroke="#142b12"
              strokeWidth="1.4"
            />
            <circle cx="150" cy="217.5" r="2.2" fill="#142b12" />

            {/* Top Penalty Box (Team A) */}
            <rect
              x="68"
              y="16"
              width="164"
              height="62"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            <rect
              x="108"
              y="16"
              width="84"
              height="24"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            <path
              d="M 118 78 A 34 34 0 0 0 182 78"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            <circle cx="150" cy="58" r="2" fill="#142b12" />

            {/* Bottom Penalty Box (Team B) */}
            <rect
              x="68"
              y="357"
              width="164"
              height="62"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            <rect
              x="108"
              y="395"
              width="84"
              height="24"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            <path
              d="M 118 357 A 34 34 0 0 1 182 357"
              fill="none"
              stroke="#142b12"
              strokeWidth="1.6"
            />
            <circle cx="150" cy="377" r="2" fill="#142b12" />

            {/* Corner arcs */}
            <path d="M 16 26 A 10 10 0 0 0 26 16" fill="none" stroke="#142b12" strokeWidth="1.4" />
            <path d="M 274 16 A 10 10 0 0 0 284 26" fill="none" stroke="#142b12" strokeWidth="1.4" />
            <path d="M 16 409 A 10 10 0 0 1 26 419" fill="none" stroke="#142b12" strokeWidth="1.4" />
            <path d="M 274 419 A 10 10 0 0 1 284 409" fill="none" stroke="#142b12" strokeWidth="1.4" />
          </svg>

          {/* Subtle half labels */}
          <span className="pointer-events-none absolute top-1 left-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-[#142b12]/70">
            Equipo A
          </span>
          <span className="pointer-events-none absolute bottom-1 left-5 font-display text-[10px] font-extrabold uppercase tracking-widest text-[#142b12]/70">
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
                  "touch-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center focus-visible:outline-none",
                  isDragging
                    ? "z-30 cursor-grabbing scale-110"
                    : "z-10 cursor-grab hover:z-20"
                )}
              >
                {/* Magnetic disc */}
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-sm font-extrabold tabular-nums shadow-[0_2px_4px_rgba(0,0,0,0.45)] transition-transform sm:h-9 sm:w-9",
                    isGk
                      ? "border-white bg-[#1e64b7] text-white"
                      : team === "A"
                        ? "border-white/90 bg-[#d92626] text-white"
                        : "border-[#1a1c1b]/80 bg-[#ecc21c] text-[#111c15]",
                    isDragging && "ring-2 ring-white"
                  )}
                >
                  {number}
                  {player.isMvp && (
                    <span
                      title="MVP"
                      className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111c15] text-[#f5b922] ring-1 ring-white"
                    >
                      <Star className="h-2.5 w-2.5 fill-current" />
                    </span>
                  )}
                </span>
                {/* Nameplate */}
                <span className="mt-0.5 max-w-[84px] truncate rounded bg-[#111c15]/88 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
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
