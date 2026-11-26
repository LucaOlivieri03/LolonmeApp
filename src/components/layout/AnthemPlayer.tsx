"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const CHORUS_START_SEC = 10;
const CHORUS_END_SEC = 21;
const CHORUS_DURATION_SEC = CHORUS_END_SEC - CHORUS_START_SEC;

export function AnthemPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<"chorus" | "full">("chorus");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (mode === "chorus") {
        if (audio.currentTime >= CHORUS_END_SEC) {
          audio.pause();
          audio.currentTime = CHORUS_START_SEC;
          setIsPlaying(false);
          setProgress(0);
          return;
        }
        const elapsed = Math.max(0, audio.currentTime - CHORUS_START_SEC);
        setProgress(Math.min(1, elapsed / CHORUS_DURATION_SEC));
      } else if (audio.duration && Number.isFinite(audio.duration)) {
        setProgress(Math.min(1, Math.max(0, audio.currentTime / audio.duration)));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [mode]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (mode === "chorus") {
      if (audio.currentTime < CHORUS_START_SEC || audio.currentTime >= CHORUS_END_SEC) {
        audio.currentTime = CHORUS_START_SEC;
      }
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const toggleMode = () => {
    const nextMode = mode === "chorus" ? "full" : "chorus";
    setMode(nextMode);
    setProgress(0);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextMode === "chorus" ? CHORUS_START_SEC : 0;
    }
  };

  return (
    <div className="relative flex items-center overflow-hidden rounded-md border border-white/20 bg-pitch-900/60">
      <audio ref={audioRef} src="/assets/cancion.mpeg" preload="none" />
      <button
        type="button"
        onClick={togglePlay}
        aria-pressed={isPlaying}
        title={isPlaying ? "Pausar himno de LOLONMEBOL" : "Reproducir himno de LOLONMEBOL"}
        aria-label={isPlaying ? "Pausar himno de LOLONMEBOL" : "Reproducir himno de LOLONMEBOL"}
        className={cn(
          "relative inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 px-2 text-xs font-semibold transition-colors lg:px-2.5",
          isPlaying
            ? "bg-leather-600 text-white"
            : "text-pitch-50 hover:bg-white/10"
        )}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
        )}
        {isPlaying && (
          <span
            aria-hidden="true"
            className="inline-flex h-3 items-end gap-[2px]"
          >
            <span
              className="anthem-eq-bar h-full w-[2px] rounded-xs bg-gold-400"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="anthem-eq-bar h-full w-[2px] rounded-xs bg-gold-400"
              style={{ animationDelay: "180ms" }}
            />
            <span
              className="anthem-eq-bar h-full w-[2px] rounded-xs bg-gold-400"
              style={{ animationDelay: "340ms" }}
            />
          </span>
        )}
        <span className="hidden lg:inline">Himno</span>
      </button>
      <button
        type="button"
        onClick={toggleMode}
        aria-pressed={mode === "full"}
        title={
          mode === "chorus"
            ? "Modo estribillo (0:10 - 0:21). Clic para cambiar a completo."
            : "Modo completo. Clic para volver al estribillo (0:10 - 0:21)."
        }
        aria-label={mode === "chorus" ? "Cambiar himno a modo completo" : "Cambiar himno a modo estribillo"}
        className={cn(
          "inline-flex min-h-10 min-w-9 items-center justify-center gap-1 border-l border-white/15 px-1.5 text-xs font-medium transition-colors hover:bg-white/10 sm:min-w-10 sm:px-2 xl:px-2.5",
          mode === "full" ? "bg-pitch-950/70 text-white" : "text-gold-400"
        )}
      >
        <Music2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline">{mode === "chorus" ? "Estrib." : "Full"}</span>
      </button>
      {progress > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/15"
        >
          <span
            className="block h-full bg-gold-400 transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}
