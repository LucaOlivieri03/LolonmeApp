"use client";

import { useRef, useState } from "react";
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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || count <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (delta <= -40) {
      goNext();
    } else if (delta >= 40) {
      goPrev();
    }
  };

  return (
    <div
      className="tactical-chalkboard overflow-hidden rounded-lg border-2 border-neutral-800 text-paper md:col-span-2"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label="Tablero de anuncios oficiales"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-white/20 bg-black/35 px-3.5 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Megaphone className="h-4 w-4 shrink-0 text-gold-400" />
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
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-dashed border-white/25 bg-white/5 text-neutral-100 transition-colors hover:border-gold-400/60 hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Siguiente anuncio"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-dashed border-white/25 bg-white/5 text-neutral-100 transition-colors hover:border-gold-400/60 hover:bg-white/15"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {!current ? (
        <p className="px-4 py-4 text-sm text-neutral-300">
          No hay comunicados oficiales escritos en el pizarrón por el momento.
        </p>
      ) : (
        <div className="p-3 sm:p-3.5">
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
                  <Pin className="h-3.5 w-3.5 shrink-0 text-gold-400" />
                )}
                <span className="truncate">{current.title}</span>
              </div>
              {current.isPinned && (
                <span className="font-display shrink-0 rounded-sm border border-dashed border-gold-400/50 bg-gold-400/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gold-400 uppercase">
                  Fijado
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-snug text-neutral-200">
              {current.body}
            </p>
          </article>

          {count > 1 && (
            <div
              className="mt-2 flex items-center justify-center gap-1.5"
              role="tablist"
              aria-label="Seleccionar anuncio"
            >
              {announcements.map((ann, idx) => {
                const isSelected = idx === safeIndex;
                return (
                  <button
                    key={ann.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`Ver anuncio ${idx + 1}: ${ann.title}`}
                    onClick={() => setActiveIndex(idx)}
                    className="inline-flex h-7 items-center justify-center px-1"
                  >
                    <span
                      className={cn(
                        "block h-1.5 rounded-sm transition-all",
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
