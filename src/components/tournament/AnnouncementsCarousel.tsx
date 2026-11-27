"use client";

import { useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Megaphone, Pin } from "lucide-react";
import type { Announcement } from "@/lib/types/domain";
import { cn } from "@/lib/utils";

interface AnnouncementsCarouselProps {
  announcements: Announcement[];
}

export function AnnouncementsCarousel({
  announcements,
}: AnnouncementsCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const slidePanelId = `${baseId}-slide`;

  const count = announcements.length;
  const safeIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
  const current = count > 0 ? announcements[safeIndex] : null;

  const goPrev = () => {
    if (count <= 1) return;
    setActiveIndex((prev) => (prev - 1 + count) % count);
  };

  const goNext = () => {
    if (count <= 1) return;
    setActiveIndex((prev) => (prev + 1) % count);
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
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
    setActiveIndex(nextIdx);
    tabRefs.current[nextIdx]?.focus();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStartX.current = touch?.clientX ?? null;
    touchStartY.current = touch?.clientY ?? null;
  };

  const handleTouchCancel = () => {
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (
      touchStartX.current === null ||
      touchStartY.current === null ||
      count <= 1
    ) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    const endX = touch?.clientX ?? touchStartX.current;
    const endY = touch?.clientY ?? touchStartY.current;
    const dx = endX - touchStartX.current;
    const dy = endY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  };

  return (
    <div
      role="region"
      className="tactical-chalkboard overflow-hidden rounded-lg border-2 border-white/15 text-paper md:col-span-2"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label="Tablero de anuncios oficiales"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-white/20 bg-black/35 px-3.5 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Megaphone className="h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
          <h2 className="font-display truncate text-base font-extrabold tracking-wider text-white uppercase sm:text-lg">
            Tablero de Anuncios
          </h2>
          {count > 0 && (
            <span className="shrink-0 rounded-sm border border-dashed border-white/30 bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-gold-400">
              {count > 1 ? `${safeIndex + 1}/${count}` : "1 aviso"}
            </span>
          )}
        </div>

        {count > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Anuncio anterior"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-dashed border-white/25 bg-white/5 text-white/90 transition-colors hover:border-gold-400/60 hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Siguiente anuncio"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-dashed border-white/25 bg-white/5 text-white/90 transition-colors hover:border-gold-400/60 hover:bg-white/15"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {!current ? (
        <p className="px-4 py-4 text-sm text-white/75">
          No hay comunicados oficiales escritos en el pizarrón por el momento.
        </p>
      ) : (
        <div className="p-3 sm:p-3.5">
          {count > 1 && (
            <span className="sr-only" aria-live="polite" aria-atomic="true">
              Anuncio {safeIndex + 1} de {count}: {current.title}
            </span>
          )}
          <div
            id={slidePanelId}
            role={count > 1 ? "tabpanel" : undefined}
            aria-labelledby={count > 1 ? `${baseId}-tab-${safeIndex}` : undefined}
          >
            <article
              key={current.id}
              className={cn(
                "tactical-chalk-card rounded-md px-3 py-2.5 transition-colors sm:px-3.5",
                current.isPinned && "border-gold-400/65 bg-white/[0.07]"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold tracking-wide text-white">
                  {current.isPinned && (
                    <Pin className="h-3.5 w-3.5 shrink-0 text-gold-400" aria-hidden="true" />
                  )}
                  <span className="truncate">{current.title}</span>
                </div>
                {current.isPinned && (
                  <span className="font-display shrink-0 rounded-sm border border-dashed border-gold-400/50 bg-gold-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gold-400 uppercase">
                    Fijado
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-snug text-white/85">
                {current.body}
              </p>
            </article>
          </div>

          {count > 1 && (
            <div
              className="mt-2 flex items-center justify-center gap-1"
              role="tablist"
              aria-label="Seleccionar anuncio"
            >
              {announcements.map((ann, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <button
                    key={ann.id}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    id={`${baseId}-tab-${idx}`}
                    type="button"
                    role="tab"
                    tabIndex={isSelected ? 0 : -1}
                    aria-selected={isSelected}
                    aria-controls={slidePanelId}
                    aria-label={`Ver anuncio ${idx + 1}: ${ann.title}`}
                    onClick={() => setActiveIndex(idx)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-sm px-1"
                  >
                    <span
                      className={cn(
                        "block h-1.5 rounded-sm transition-all motion-reduce:transition-none",
                        isSelected
                          ? "w-6 bg-gold-400"
                          : "w-2 bg-white/30 hover:bg-white/55"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
